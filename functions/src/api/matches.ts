import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireAuth } from '../lib/auth';
import { scorePhase1 } from '../scoring/phase1';
import { Company, Match, MatchPhase, ScoreBreakdown, Talent } from '../types';

function matchIdFor(talentId: string, companyId: string): string {
  return `${talentId}_${companyId}`;
}

function computeCurrentTotal(phase: MatchPhase, breakdown: ScoreBreakdown): number {
  if (phase === 3 && breakdown.phase3) return breakdown.phase3.total;
  if (phase >= 2 && breakdown.phase2to3) return breakdown.phase2to3.total;
  return breakdown.phase1.total;
}

function scorePhase1For(talent: Talent, company: Company) {
  return scorePhase1({
    talentSkills: talent.skills,
    wantedPersonaTags: company.wantedPersonaTags,
    wantedPersonaTagWeights: company.wantedPersonaTagWeights,
    talentWeeklyAvailableHours: talent.weeklyAvailableHours,
    companyRequiredWeeklyHours: company.requiredWeeklyHours,
    sideJobAcceptable: company.sideJobAcceptable,
    interestedIndustries: talent.interestedIndustries,
    companyIndustry: company.industry,
    talentPrefecture: talent.prefecture,
    companyPrefecture: company.prefecture,
    relocatable: talent.relocatable,
    workStyle: talent.workStyle,
  });
}

/**
 * (Re)computes phase-1 fit scores between the calling talent/company and
 * every profile on the other side, creating a `matches` doc for any new
 * pairing and refreshing the stored phase1 breakdown for existing ones.
 * The match's phase/status/message history are never reset by a refresh —
 * only the phase1 breakdown (and currentTotal, while still in phase 1) is
 * recalculated, so re-running this after either profile changes keeps
 * ongoing relationships intact.
 */
export const refreshMatchesForCaller = onCall(async (request) => {
  const { uid, role } = requireAuth(request);
  if (role !== 'talent' && role !== 'company') {
    throw new HttpsError('failed-precondition', 'talents/companies いずれかのロールが必要です。');
  }

  if (role === 'talent') {
    const talentSnap = await db.collection('talents').doc(uid).get();
    if (!talentSnap.exists) throw new HttpsError('failed-precondition', '先に人材プロフィールを登録してください。');
    const talent = { id: talentSnap.id, ...talentSnap.data() } as Talent;

    const companiesSnap = await db.collection('companies').get();
    const results = await Promise.all(
      companiesSnap.docs.map((doc) => upsertMatch(talent, { id: doc.id, ...doc.data() } as Company))
    );
    return { matched: results.length };
  }

  const companySnap = await db.collection('companies').doc(uid).get();
  if (!companySnap.exists) throw new HttpsError('failed-precondition', '先に企業プロフィールを登録してください。');
  const company = { id: companySnap.id, ...companySnap.data() } as Company;

  const talentsSnap = await db.collection('talents').get();
  const results = await Promise.all(
    talentsSnap.docs.map((doc) => upsertMatch({ id: doc.id, ...doc.data() } as Talent, company))
  );
  return { matched: results.length };
});

async function upsertMatch(talent: Talent, company: Company): Promise<string> {
  const id = matchIdFor(talent.id, company.id);
  const ref = db.collection('matches').doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const phase1 = scorePhase1For(talent, company);

    if (!snap.exists) {
      const scoreBreakdown: ScoreBreakdown = { phase1, currentTotal: phase1.total };
      const match: Partial<Match> = {
        talentId: talent.id,
        companyId: company.id,
        phase: 1,
        status: 'active',
        scoreBreakdown,
        reviews: {},
        messageCount: 0,
        phaseEnteredAt: { 1: FieldValue.serverTimestamp() },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.set(ref, match);
      return;
    }

    const existing = snap.data() as Match;
    const scoreBreakdown: ScoreBreakdown = { ...existing.scoreBreakdown, phase1 };
    const currentTotal = computeCurrentTotal(existing.phase, scoreBreakdown);
    tx.update(ref, {
      scoreBreakdown: { ...scoreBreakdown, currentTotal },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return id;
}

function isParticipant(uid: string, match: Match): boolean {
  return match.talentId === uid || match.companyId === uid;
}

export const listMatchesForCaller = onCall(async (request) => {
  const { uid, role } = requireAuth(request);
  const phase = request.data?.phase as MatchPhase | undefined;
  if (phase !== undefined && ![1, 2, 3].includes(phase)) {
    throw new HttpsError('invalid-argument', 'phase は 1, 2, 3 のいずれかである必要があります。');
  }

  const field = role === 'company' ? 'companyId' : 'talentId';
  let query = db.collection('matches').where(field, '==', uid) as FirebaseFirestore.Query;
  if (phase !== undefined) {
    query = query.where('phase', '==', phase);
  }
  const snap = await query.get();
  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Match)
    .filter((m) => isParticipant(uid, m))
    .sort((a, b) => b.scoreBreakdown.currentTotal - a.scoreBreakdown.currentTotal);

  return { matches };
});
