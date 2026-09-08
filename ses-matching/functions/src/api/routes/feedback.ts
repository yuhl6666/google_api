import { Router } from 'express';
import { Query, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db, WEIGHTS_DOC_ID } from '../../firestoreAdmin';
import { FeedbackDecision, FeedbackLogDoc, MatchResultDoc, WeightsSettingsDoc } from '../../models';
import { adjustWeightsFromFeedback, DEFAULT_WEIGHTS, FeedbackSample } from '../../scoring';
import { ApiError, asyncHandler } from '../asyncHandler';

export const feedbackRouter = Router();

const DECISION_TO_STATUS: Record<FeedbackDecision, MatchResultDoc['status']> = {
  採用: '成約',
  却下: '却下',
};

/** フィードバック履歴全件から重みを再学習し、settings/weightsへ保存する */
async function relearnWeights(): Promise<WeightsSettingsDoc> {
  const currentDoc = await db.collection(COLLECTIONS.settings).doc(WEIGHTS_DOC_ID).get();
  const currentWeights = currentDoc.exists ? (currentDoc.data() as WeightsSettingsDoc) : DEFAULT_WEIGHTS;

  const feedbackSnapshot = await db.collection(COLLECTIONS.feedbackLog).get();
  const samples: FeedbackSample[] = feedbackSnapshot.docs.map((d) => {
    const data = d.data() as FeedbackLogDoc;
    return { decision: data.decision, breakdown: data.scoreBreakdownAtFeedback };
  });

  const updatedWeights = adjustWeightsFromFeedback(currentWeights, samples);
  const data: WeightsSettingsDoc = { ...updatedWeights, updatedAt: Timestamp.now() };
  await db.collection(COLLECTIONS.settings).doc(WEIGHTS_DOC_ID).set(data);
  return data;
}

feedbackRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    let query: Query = db.collection(COLLECTIONS.feedbackLog);
    if (req.query.matchId) query = query.where('matchId', '==', req.query.matchId);
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const feedbackLogs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ feedbackLogs });
  }),
);

feedbackRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { matchId, decision, reasonNote } = req.body as {
      matchId?: string;
      decision?: FeedbackDecision;
      reasonNote?: string;
    };

    if (!matchId) throw new ApiError(400, 'matchIdは必須です');
    if (decision !== '採用' && decision !== '却下') {
      throw new ApiError(400, 'decisionは"採用"または"却下"である必要があります');
    }

    const matchRef = db.collection(COLLECTIONS.matchResults).doc(matchId);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) throw new ApiError(404, 'マッチング結果が見つかりません');
    const match = matchDoc.data() as MatchResultDoc;

    const now = Timestamp.now();
    const feedbackData: Omit<FeedbackLogDoc, 'id'> = {
      matchId,
      projectId: match.projectId,
      engineerId: match.engineerId,
      decision,
      reasonNote: reasonNote ?? '',
      scoreBreakdownAtFeedback: match.scoreBreakdown,
      createdAt: now,
    };
    const feedbackRef = await db.collection(COLLECTIONS.feedbackLog).add(feedbackData);

    await matchRef.update({ status: DECISION_TO_STATUS[decision], updatedAt: now });

    const updatedWeights = await relearnWeights();

    res.status(201).json({
      feedback: { id: feedbackRef.id, ...feedbackData },
      updatedWeights,
    });
  }),
);
