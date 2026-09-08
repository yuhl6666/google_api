import { Router } from 'express';
import { Query, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db, WEIGHTS_DOC_ID } from '../../firestoreAdmin';
import { EngineerDoc, MatchResultDoc, MatchStatus, ProjectDoc } from '../../models';
import { calcTotalScore, DEFAULT_WEIGHTS, ScoreWeights } from '../../scoring';
import { ApiError, asyncHandler } from '../asyncHandler';

export const matchesRouter = Router();

const VALID_STATUSES: MatchStatus[] = ['未対応', '提案済', '成約', '却下'];

function matchDocId(projectId: string, engineerId: string): string {
  return `${projectId}_${engineerId}`;
}

async function getCurrentWeights(): Promise<ScoreWeights> {
  const doc = await db.collection(COLLECTIONS.settings).doc(WEIGHTS_DOC_ID).get();
  if (!doc.exists) return DEFAULT_WEIGHTS;
  const data = doc.data() as ScoreWeights;
  return data;
}

async function runMatchingForPairs(
  projects: (ProjectDoc & { id: string })[],
  engineers: (EngineerDoc & { id: string })[],
): Promise<MatchResultDoc[]> {
  const weights = await getCurrentWeights();
  const now = Timestamp.now();
  const batch = db.batch();
  const results: MatchResultDoc[] = [];

  for (const project of projects) {
    for (const engineer of engineers) {
      const { totalScore, breakdown } = calcTotalScore(project, engineer, weights);
      const id = matchDocId(project.id, engineer.id);
      const ref = db.collection(COLLECTIONS.matchResults).doc(id);
      const existing = await ref.get();
      const status: MatchStatus = existing.exists ? (existing.data() as MatchResultDoc).status : '未対応';

      const data: Omit<MatchResultDoc, 'id'> = {
        projectId: project.id,
        engineerId: engineer.id,
        projectName: project.name,
        engineerName: engineer.name,
        totalScore,
        scoreBreakdown: breakdown,
        status,
        createdAt: existing.exists ? (existing.data() as MatchResultDoc).createdAt : now,
        updatedAt: now,
      };
      batch.set(ref, data, { merge: true });
      results.push({ id, ...data });
    }
  }

  await batch.commit();
  return results.sort((a, b) => b.totalScore - a.totalScore);
}

matchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    let query: Query = db.collection(COLLECTIONS.matchResults);
    if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId);
    if (req.query.engineerId) query = query.where('engineerId', '==', req.query.engineerId);
    if (req.query.status) query = query.where('status', '==', req.query.status);

    const snapshot = await query.get();
    const matches = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as MatchResultDoc)
      .sort((a, b) => b.totalScore - a.totalScore);
    res.json({ matches });
  }),
);

matchesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await db.collection(COLLECTIONS.matchResults).doc(req.params.id).get();
    if (!doc.exists) throw new ApiError(404, 'マッチング結果が見つかりません');
    res.json({ match: { id: doc.id, ...doc.data() } });
  }),
);

matchesRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const { projectId, engineerId } = req.body as { projectId?: string; engineerId?: string };

    let projects: (ProjectDoc & { id: string })[];
    let engineers: (EngineerDoc & { id: string })[];

    if (projectId) {
      const doc = await db.collection(COLLECTIONS.projects).doc(projectId).get();
      if (!doc.exists) throw new ApiError(404, '案件が見つかりません');
      projects = [{ ...(doc.data() as ProjectDoc), id: doc.id }];
    } else {
      const snapshot = await db.collection(COLLECTIONS.projects).get();
      projects = snapshot.docs.map((d) => ({ ...(d.data() as ProjectDoc), id: d.id }));
    }

    if (engineerId) {
      const doc = await db.collection(COLLECTIONS.engineers).doc(engineerId).get();
      if (!doc.exists) throw new ApiError(404, '要員が見つかりません');
      engineers = [{ ...(doc.data() as EngineerDoc), id: doc.id }];
    } else {
      const snapshot = await db.collection(COLLECTIONS.engineers).get();
      engineers = snapshot.docs.map((d) => ({ ...(d.data() as EngineerDoc), id: d.id }));
    }

    const matches = await runMatchingForPairs(projects, engineers);
    res.json({ matches, count: matches.length });
  }),
);

matchesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: MatchStatus };
    if (!status || !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `statusは次のいずれかである必要があります: ${VALID_STATUSES.join(', ')}`);
    }
    const ref = db.collection(COLLECTIONS.matchResults).doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) throw new ApiError(404, 'マッチング結果が見つかりません');

    await ref.update({ status, updatedAt: Timestamp.now() });
    const updated = await ref.get();
    res.json({ match: { id: updated.id, ...updated.data() } });
  }),
);
