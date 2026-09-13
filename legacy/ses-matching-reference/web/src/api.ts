import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { adjustWeightsFromFeedback, calcTotalScore, DEFAULT_WEIGHTS, FeedbackSample } from './scoring';
import {
  Engineer,
  FeedbackLog,
  MatchResult,
  MatchStatus,
  Project,
  ScoreWeights,
} from './types';

const COLLECTIONS = {
  projects: 'projects',
  engineers: 'engineers',
  matchResults: 'matchResults',
  feedbackLog: 'feedbackLog',
  settings: 'settings',
} as const;

const WEIGHTS_DOC_ID = 'weights';

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function matchDocId(projectId: string, engineerId: string): string {
  return `${projectId}_${engineerId}`;
}

/** Firestoreのバッチ書き込みは1回最大500件までのため、安全のため400件ずつに分割する */
async function commitInChunks(writes: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + CHUNK_SIZE)) {
      batch.set(w.ref, w.data, { merge: true });
    }
    await batch.commit();
  }
}

// --- Projects ---
export const listProjects = async (): Promise<{ projects: Project[] }> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.projects), orderBy('createdAt', 'desc')));
  return { projects: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Project) };
};

export const getProject = async (id: string): Promise<{ project: Project }> => {
  const snap = await getDoc(doc(db, COLLECTIONS.projects, id));
  if (!snap.exists()) throw new ApiRequestError(404, '案件が見つかりません');
  return { project: { id: snap.id, ...snap.data() } as Project };
};

export const createProject = async (data: Omit<Project, 'id'>): Promise<{ project: Project }> => {
  const now = Timestamp.now();
  const payload = { ...data, createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, COLLECTIONS.projects), payload);
  return { project: { id: ref.id, ...payload } as Project };
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<{ project: Project }> => {
  const ref = doc(db, COLLECTIONS.projects, id);
  const { id: _ignored, ...updatable } = data;
  await updateDoc(ref, { ...updatable, updatedAt: Timestamp.now() });
  const snap = await getDoc(ref);
  return { project: { id: snap.id, ...snap.data() } as Project };
};

export const deleteProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.projects, id));
};

// --- Engineers ---
export const listEngineers = async (): Promise<{ engineers: Engineer[] }> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.engineers), orderBy('createdAt', 'desc')));
  return { engineers: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Engineer) };
};

export const getEngineer = async (id: string): Promise<{ engineer: Engineer }> => {
  const snap = await getDoc(doc(db, COLLECTIONS.engineers, id));
  if (!snap.exists()) throw new ApiRequestError(404, '要員が見つかりません');
  return { engineer: { id: snap.id, ...snap.data() } as Engineer };
};

export const createEngineer = async (data: Omit<Engineer, 'id'>): Promise<{ engineer: Engineer }> => {
  const now = Timestamp.now();
  const payload = { ...data, createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, COLLECTIONS.engineers), payload);
  return { engineer: { id: ref.id, ...payload } as Engineer };
};

export const updateEngineer = async (id: string, data: Partial<Engineer>): Promise<{ engineer: Engineer }> => {
  const ref = doc(db, COLLECTIONS.engineers, id);
  const { id: _ignored, ...updatable } = data;
  await updateDoc(ref, { ...updatable, updatedAt: Timestamp.now() });
  const snap = await getDoc(ref);
  return { engineer: { id: snap.id, ...snap.data() } as Engineer };
};

export const deleteEngineer = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.engineers, id));
};

// --- Weights ---
export const getWeights = async (): Promise<{ weights: ScoreWeights }> => {
  const snap = await getDoc(doc(db, COLLECTIONS.settings, WEIGHTS_DOC_ID));
  if (!snap.exists()) return { weights: DEFAULT_WEIGHTS };
  return { weights: snap.data() as ScoreWeights };
};

export const putWeights = async (weights: ScoreWeights): Promise<{ weights: ScoreWeights }> => {
  const total = weights.skillWeight + weights.rateWeight + weights.locationWeight + weights.timingWeight;
  const normalized: ScoreWeights =
    total > 0
      ? {
          skillWeight: weights.skillWeight / total,
          rateWeight: weights.rateWeight / total,
          locationWeight: weights.locationWeight / total,
          timingWeight: weights.timingWeight / total,
        }
      : { skillWeight: 0.25, rateWeight: 0.25, locationWeight: 0.25, timingWeight: 0.25 };
  const data = { ...normalized, updatedAt: Timestamp.now() };
  await setDoc(doc(db, COLLECTIONS.settings, WEIGHTS_DOC_ID), data, { merge: true });
  return { weights: normalized };
};

// --- Matches ---
export const listMatches = async (params?: {
  projectId?: string;
  engineerId?: string;
  status?: MatchStatus;
}): Promise<{ matches: MatchResult[] }> => {
  const clauses = [];
  if (params?.projectId) clauses.push(where('projectId', '==', params.projectId));
  if (params?.engineerId) clauses.push(where('engineerId', '==', params.engineerId));
  if (params?.status) clauses.push(where('status', '==', params.status));

  const q = clauses.length > 0 ? query(collection(db, COLLECTIONS.matchResults), ...clauses) : collection(db, COLLECTIONS.matchResults);
  const snapshot = await getDocs(q);
  const matches = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MatchResult)
    .sort((a, b) => b.totalScore - a.totalScore);
  return { matches };
};

export const runMatching = async (params: {
  projectId?: string;
  engineerId?: string;
}): Promise<{ matches: MatchResult[]; count: number }> => {
  const { weights } = await getWeights();

  let projects: Project[];
  if (params.projectId) {
    const { project } = await getProject(params.projectId);
    projects = [project];
  } else {
    projects = (await listProjects()).projects;
  }

  let engineers: Engineer[];
  if (params.engineerId) {
    const { engineer } = await getEngineer(params.engineerId);
    engineers = [engineer];
  } else {
    engineers = (await listEngineers()).engineers;
  }

  const now = Timestamp.now();
  const writes: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];
  const results: MatchResult[] = [];

  for (const project of projects) {
    for (const engineer of engineers) {
      const { totalScore, breakdown } = calcTotalScore(project, engineer, weights);
      const id = matchDocId(project.id, engineer.id);
      const ref = doc(db, COLLECTIONS.matchResults, id);
      const existingSnap = await getDoc(ref);
      const status: MatchStatus = existingSnap.exists() ? (existingSnap.data() as MatchResult).status : '未対応';
      const createdAt = existingSnap.exists() ? (existingSnap.data() as { createdAt: Timestamp }).createdAt : now;

      const data = {
        projectId: project.id,
        engineerId: engineer.id,
        projectName: project.name,
        engineerName: engineer.name,
        totalScore,
        scoreBreakdown: breakdown,
        status,
        createdAt,
        updatedAt: now,
      };
      writes.push({ ref, data });
      results.push({ id, ...data } as MatchResult);
    }
  }

  await commitInChunks(writes);
  results.sort((a, b) => b.totalScore - a.totalScore);
  return { matches: results, count: results.length };
};

export const updateMatchStatus = async (id: string, status: MatchStatus): Promise<{ match: MatchResult }> => {
  const ref = doc(db, COLLECTIONS.matchResults, id);
  await updateDoc(ref, { status, updatedAt: Timestamp.now() });
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new ApiRequestError(404, 'マッチング結果が見つかりません');
  return { match: { id: snap.id, ...snap.data() } as MatchResult };
};

// --- Feedback ---
const DECISION_TO_STATUS: Record<'採用' | '却下', MatchStatus> = {
  採用: '成約',
  却下: '却下',
};

export const submitFeedback = async (data: {
  matchId: string;
  decision: '採用' | '却下';
  reasonNote?: string;
}): Promise<{ feedback: FeedbackLog; updatedWeights: ScoreWeights }> => {
  const matchRef = doc(db, COLLECTIONS.matchResults, data.matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) throw new ApiRequestError(404, 'マッチング結果が見つかりません');
  const match = matchSnap.data() as MatchResult;

  const now = Timestamp.now();
  const feedbackData = {
    matchId: data.matchId,
    projectId: match.projectId,
    engineerId: match.engineerId,
    decision: data.decision,
    reasonNote: data.reasonNote ?? '',
    scoreBreakdownAtFeedback: match.scoreBreakdown,
    createdAt: now,
  };
  const feedbackRef = await addDoc(collection(db, COLLECTIONS.feedbackLog), feedbackData);

  await updateDoc(matchRef, { status: DECISION_TO_STATUS[data.decision], updatedAt: now });

  const updatedWeights = await relearnWeights();

  return {
    feedback: { id: feedbackRef.id, ...feedbackData } as FeedbackLog,
    updatedWeights,
  };
};

/** フィードバック履歴全件から重みを再学習し、settings/weightsへ保存する */
async function relearnWeights(): Promise<ScoreWeights> {
  const { weights: currentWeights } = await getWeights();
  const snapshot = await getDocs(collection(db, COLLECTIONS.feedbackLog));
  const samples: FeedbackSample[] = snapshot.docs.map((d) => {
    const data = d.data() as { decision: '採用' | '却下'; scoreBreakdownAtFeedback: FeedbackSample['breakdown'] };
    return { decision: data.decision, breakdown: data.scoreBreakdownAtFeedback };
  });
  const updated = adjustWeightsFromFeedback(currentWeights, samples);
  await putWeights(updated);
  return updated;
};
