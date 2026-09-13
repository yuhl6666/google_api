import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from '../../firestoreAdmin';
import { EngineerDoc } from '../../models';
import { ApiError, asyncHandler } from '../asyncHandler';

export const engineersRouter = Router();

function validateEngineerBody(body: Record<string, unknown>): void {
  const requiredFields = ['name', 'skills', 'desiredRateMin', 'desiredRateMax', 'desiredLocations', 'availableFrom'];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      throw new ApiError(400, `${field} は必須です`);
    }
  }
  if (typeof body.desiredRateMin !== 'number' || typeof body.desiredRateMax !== 'number') {
    throw new ApiError(400, 'desiredRateMin/desiredRateMaxは数値で指定してください');
  }
  if (body.desiredRateMax < body.desiredRateMin) {
    throw new ApiError(400, 'desiredRateMaxはdesiredRateMin以上である必要があります');
  }
  if (!Array.isArray(body.skills)) {
    throw new ApiError(400, 'skillsは配列で指定してください');
  }
  if (!Array.isArray(body.desiredLocations)) {
    throw new ApiError(400, 'desiredLocationsは配列で指定してください');
  }
}

engineersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const snapshot = await db.collection(COLLECTIONS.engineers).orderBy('createdAt', 'desc').get();
    const engineers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ engineers });
  }),
);

engineersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await db.collection(COLLECTIONS.engineers).doc(req.params.id).get();
    if (!doc.exists) throw new ApiError(404, '要員が見つかりません');
    res.json({ engineer: { id: doc.id, ...doc.data() } });
  }),
);

engineersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    validateEngineerBody(req.body);
    const now = Timestamp.now();
    const data: Omit<EngineerDoc, 'id'> = {
      name: req.body.name,
      skills: req.body.skills,
      desiredRateMin: req.body.desiredRateMin,
      desiredRateMax: req.body.desiredRateMax,
      desiredLocations: req.body.desiredLocations,
      remoteDesired: Boolean(req.body.remoteDesired),
      availableFrom: req.body.availableFrom,
      japaneseLevel: req.body.japaneseLevel ?? 'none',
      sourceSkillSheetBody: req.body.sourceSkillSheetBody ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db.collection(COLLECTIONS.engineers).add(data);
    res.status(201).json({ engineer: { id: ref.id, ...data } });
  }),
);

engineersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const ref = db.collection(COLLECTIONS.engineers).doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) throw new ApiError(404, '要員が見つかりません');
    validateEngineerBody({ ...existing.data(), ...req.body });

    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...updatable } = req.body;
    await ref.update({ ...updatable, updatedAt: Timestamp.now() });
    const updated = await ref.get();
    res.json({ engineer: { id: updated.id, ...updated.data() } });
  }),
);

engineersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await db.collection(COLLECTIONS.engineers).doc(req.params.id).delete();
    res.status(204).send();
  }),
);
