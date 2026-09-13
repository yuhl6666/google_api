import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db, WEIGHTS_DOC_ID } from '../../firestoreAdmin';
import { WeightsSettingsDoc } from '../../models';
import { DEFAULT_WEIGHTS, normalizeWeights } from '../../scoring';
import { ApiError, asyncHandler } from '../asyncHandler';

export const weightsRouter = Router();

async function getWeightsDoc(): Promise<WeightsSettingsDoc> {
  const doc = await db.collection(COLLECTIONS.settings).doc(WEIGHTS_DOC_ID).get();
  if (!doc.exists) {
    return { ...DEFAULT_WEIGHTS, updatedAt: Timestamp.now() };
  }
  return doc.data() as WeightsSettingsDoc;
}

weightsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const weights = await getWeightsDoc();
    res.json({ weights });
  }),
);

weightsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { skillWeight, rateWeight, locationWeight, timingWeight } = req.body;
    for (const [key, value] of Object.entries({ skillWeight, rateWeight, locationWeight, timingWeight })) {
      if (typeof value !== 'number' || value < 0) {
        throw new ApiError(400, `${key} は0以上の数値で指定してください`);
      }
    }
    const normalized = normalizeWeights({ skillWeight, rateWeight, locationWeight, timingWeight });
    const data: WeightsSettingsDoc = { ...normalized, updatedAt: Timestamp.now() };
    await db.collection(COLLECTIONS.settings).doc(WEIGHTS_DOC_ID).set(data);
    res.json({ weights: data });
  }),
);
