import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from '../../firestoreAdmin';
import { ProjectDoc } from '../../models';
import { ApiError, asyncHandler } from '../asyncHandler';

export const projectsRouter = Router();

function validateProjectBody(body: Record<string, unknown>): void {
  const requiredFields = ['name', 'requiredSkills', 'rateMin', 'rateMax', 'location', 'startDate'];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      throw new ApiError(400, `${field} は必須です`);
    }
  }
  if (typeof body.rateMin !== 'number' || typeof body.rateMax !== 'number') {
    throw new ApiError(400, 'rateMin/rateMaxは数値で指定してください');
  }
  if (body.rateMax < body.rateMin) {
    throw new ApiError(400, 'rateMaxはrateMin以上である必要があります');
  }
  if (!Array.isArray(body.requiredSkills)) {
    throw new ApiError(400, 'requiredSkillsは配列で指定してください');
  }
}

projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const snapshot = await db.collection(COLLECTIONS.projects).orderBy('createdAt', 'desc').get();
    const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ projects });
  }),
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await db.collection(COLLECTIONS.projects).doc(req.params.id).get();
    if (!doc.exists) throw new ApiError(404, '案件が見つかりません');
    res.json({ project: { id: doc.id, ...doc.data() } });
  }),
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    validateProjectBody(req.body);
    const now = Timestamp.now();
    const data: Omit<ProjectDoc, 'id'> = {
      name: req.body.name,
      requiredSkills: req.body.requiredSkills,
      rateMin: req.body.rateMin,
      rateMax: req.body.rateMax,
      location: req.body.location,
      remoteAllowed: Boolean(req.body.remoteAllowed),
      startDate: req.body.startDate,
      durationMonths: req.body.durationMonths ?? null,
      commercialTier: req.body.commercialTier ?? null,
      japaneseLevel: req.body.japaneseLevel ?? 'none',
      sourceEmailBody: req.body.sourceEmailBody ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db.collection(COLLECTIONS.projects).add(data);
    res.status(201).json({ project: { id: ref.id, ...data } });
  }),
);

projectsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const ref = db.collection(COLLECTIONS.projects).doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) throw new ApiError(404, '案件が見つかりません');
    validateProjectBody({ ...existing.data(), ...req.body });

    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...updatable } = req.body;
    await ref.update({ ...updatable, updatedAt: Timestamp.now() });
    const updated = await ref.get();
    res.json({ project: { id: updated.id, ...updated.data() } });
  }),
);

projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await db.collection(COLLECTIONS.projects).doc(req.params.id).delete();
    res.status(204).send();
  }),
);
