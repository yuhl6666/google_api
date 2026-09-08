import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp } from '../lib/admin';
import { requireAuth } from '../lib/auth';
import { scorePhase2To3, PHASE2TO3_PROMOTION_THRESHOLD } from '../scoring/phase2to3';
import { scorePhase3 } from '../scoring/phase3';
import { Company, Match, MatchPhase, ScoreBreakdown, Talent } from '../types';

const PHASE1_PROMOTION_THRESHOLD = 0.6;

function assertParticipant(uid: string, match: Match): 'talent' | 'company' {
  if (match.talentId === uid) return 'talent';
  if (match.companyId === uid) return 'company';
  throw new HttpsError('permission-denied', 'このマッチの当事者ではありません。');
}

function daysSince(timestamp: Timestamp | FirebaseFirestore.FieldValue | undefined): number {
  if (!timestamp || !(timestamp instanceof Timestamp)) return 0;
  const ms = Date.now() - timestamp.toMillis();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

/**
 * Records that one side wishes to continue past phase 1. Promotion to
 * phase 2 requires both sides to have expressed this (mutual intent), in
 * addition to clearing the phase-1 score threshold.
 */
export const expressContinuationIntent = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const matchId = request.data?.matchId;
  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');

  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
  const match = snap.data() as Match;
  const side = assertParticipant(uid, match);

  await ref.update({
    [`continuationIntent.${side}`]: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

interface PromotionEvaluation {
  phase: MatchPhase;
  eligible: boolean;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
}

/**
 * Computes (without committing) whether a match currently qualifies for
 * promotion to the next phase, refreshing the relevant score breakdown so
 * the UI can show an up-to-date score even before promoting.
 */
async function evaluate(matchId: string): Promise<{ match: Match; evaluation: PromotionEvaluation }> {
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
  const match = { id: snap.id, ...snap.data() } as Match;

  if (match.phase === 1) {
    const mutualIntent = Boolean(match.continuationIntent?.talent && match.continuationIntent?.company);
    const total = match.scoreBreakdown.phase1.total;
    const eligible = total >= PHASE1_PROMOTION_THRESHOLD && mutualIntent;
    return {
      match,
      evaluation: {
        phase: 1,
        eligible,
        reason: eligible
          ? 'フェーズ1スコアが基準を満たし、双方が継続を希望しています。'
          : `フェーズ1スコア(${total}) >= ${PHASE1_PROMOTION_THRESHOLD} かつ双方の継続希望が必要です。`,
        scoreBreakdown: match.scoreBreakdown,
      },
    };
  }

  if (match.phase === 2) {
    const phase2to3 = scorePhase2To3({
      engagementDurationDays: daysSince(match.phaseEnteredAt?.[1]),
      messageCount: match.messageCount ?? 0,
      talentRating: match.reviews?.talentRating,
      companyRating: match.reviews?.companyRating,
      phase1Total: match.scoreBreakdown.phase1.total,
    });
    const scoreBreakdown: ScoreBreakdown = { ...match.scoreBreakdown, phase2to3, currentTotal: phase2to3.total };
    await ref.update({ scoreBreakdown, updatedAt: FieldValue.serverTimestamp() });

    return {
      match: { ...match, scoreBreakdown },
      evaluation: {
        phase: 2,
        eligible: phase2to3.eligibleForPhase3,
        reason: phase2to3.eligibleForPhase3
          ? '関与期間・やり取り量・レビューの総合スコアが承継検討フェーズの基準を満たしています。'
          : `昇格スコア(${phase2to3.total}) が基準(${PHASE2TO3_PROMOTION_THRESHOLD})未満です。`,
        scoreBreakdown,
      },
    };
  }

  return {
    match,
    evaluation: {
      phase: match.phase,
      eligible: false,
      reason: 'フェーズ3は最終フェーズです。承継成立(complete)または解消(decline)のみ選択できます。',
      scoreBreakdown: match.scoreBreakdown,
    },
  };
}

export const evaluatePhaseUpgrade = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const matchId = request.data?.matchId;
  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');
  const { match, evaluation } = await evaluate(matchId);
  assertParticipant(uid, match);
  return evaluation;
});

type PhaseAction = 'promote' | 'decline' | 'complete';

async function writeHistory(matchId: string, fromPhase: MatchPhase | null, toPhase: MatchPhase | 'declined' | 'completed', reason: string, changedBy: string, scoreAtChange: number) {
  await db.collection('phaseHistory').add({
    matchId,
    fromPhase,
    toPhase,
    reason,
    changedBy,
    scoreAtChange,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Commits a phase transition. `promote` re-validates eligibility server-side
 * (never trusts the client), `decline`/`complete` are manual actions either
 * participant (decline) may take at any time, or that make sense once in
 * phase 3 (complete = succession finalized).
 */
export const changePhase = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const matchId = request.data?.matchId;
  const action = request.data?.action as PhaseAction;
  const reason = typeof request.data?.reason === 'string' ? request.data.reason : '';

  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');
  if (!['promote', 'decline', 'complete'].includes(action)) {
    throw new HttpsError('invalid-argument', 'action は promote/decline/complete のいずれかである必要があります。');
  }

  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
  const match = { id: snap.id, ...snap.data() } as Match;
  assertParticipant(uid, match);

  if (match.status !== 'active') {
    throw new HttpsError('failed-precondition', 'このマッチは既に終了しています。');
  }

  if (action === 'decline') {
    await ref.update({ status: 'declined', updatedAt: FieldValue.serverTimestamp() });
    await writeHistory(matchId, match.phase, 'declined', reason || '当事者による解消', uid, match.scoreBreakdown.currentTotal);
    return { status: 'declined' };
  }

  if (action === 'complete') {
    if (match.phase !== 3) throw new HttpsError('failed-precondition', 'フェーズ3のマッチのみ承継成立にできます。');
    await ref.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
    await writeHistory(matchId, 3, 'completed', reason || '事業承継が成立しました。', uid, match.scoreBreakdown.currentTotal);
    return { status: 'completed' };
  }

  // action === 'promote'
  const { evaluation } = await evaluate(matchId);
  if (!evaluation.eligible) {
    throw new HttpsError('failed-precondition', evaluation.reason);
  }

  if (match.phase === 1) {
    await ref.update({
      phase: 2,
      'phaseEnteredAt.2': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeHistory(matchId, 1, 2, reason || evaluation.reason, uid, evaluation.scoreBreakdown.currentTotal);
    return { status: 'active', phase: 2 };
  }

  if (match.phase === 2) {
    const [talentSnap, companySnap] = await Promise.all([
      db.collection('talents').doc(match.talentId).get(),
      db.collection('companies').doc(match.companyId).get(),
    ]);
    if (!talentSnap.exists || !companySnap.exists) {
      throw new HttpsError('failed-precondition', 'プロフィールが見つからないためフェーズ3スコアを算出できません。');
    }
    const talent = talentSnap.data() as Talent;
    const company = companySnap.data() as Company;
    const phase3 = scorePhase3({
      successionInterestLevel: talent.successionInterestLevel,
      fundingCapacity: talent.fundingCapacity,
      successionTimeframe: company.successionTimeframe,
      talentPrefecture: talent.prefecture,
      companyPrefecture: company.prefecture,
      relocatable: talent.relocatable,
    });
    const scoreBreakdown: ScoreBreakdown = { ...evaluation.scoreBreakdown, phase3, currentTotal: phase3.total };

    await ref.update({
      phase: 3,
      scoreBreakdown,
      'phaseEnteredAt.3': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeHistory(matchId, 2, 3, reason || evaluation.reason, uid, phase3.total);
    return { status: 'active', phase: 3 };
  }

  throw new HttpsError('failed-precondition', 'これ以上昇格できません。');
});

export const listPhaseHistory = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const matchId = request.data?.matchId;
  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');

  const matchSnap = await db.collection('matches').doc(matchId).get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
  assertParticipant(uid, matchSnap.data() as Match);

  const historySnap = await db.collection('phaseHistory').where('matchId', '==', matchId).orderBy('createdAt', 'asc').get();
  return { history: historySnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
