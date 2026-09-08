import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireRole, requireAuth } from '../lib/auth';
import { Talent, WorkStyle } from '../types';

const WORK_STYLES: WorkStyle[] = ['remote', 'onsite', 'both'];

interface UpsertTalentInput {
  name: string;
  skills: string[];
  interestedIndustries: string[];
  weeklyAvailableHours: number;
  workStyle: WorkStyle;
  relocatable: boolean;
  prefecture: string;
  successionInterestLevel: 1 | 2 | 3 | 4 | 5;
  fundingCapacity: number;
  bio?: string;
}

function validateUpsert(data: Partial<UpsertTalentInput>): asserts data is UpsertTalentInput {
  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'name は必須です。');
  }
  if (!Array.isArray(data.skills) || !data.skills.every((s) => typeof s === 'string')) {
    throw new HttpsError('invalid-argument', 'skills は文字列配列である必要があります。');
  }
  if (!Array.isArray(data.interestedIndustries) || !data.interestedIndustries.every((s) => typeof s === 'string')) {
    throw new HttpsError('invalid-argument', 'interestedIndustries は文字列配列である必要があります。');
  }
  if (typeof data.weeklyAvailableHours !== 'number' || data.weeklyAvailableHours < 0) {
    throw new HttpsError('invalid-argument', 'weeklyAvailableHours は0以上の数値である必要があります。');
  }
  if (!data.workStyle || !WORK_STYLES.includes(data.workStyle)) {
    throw new HttpsError('invalid-argument', `workStyle は ${WORK_STYLES.join('/')} のいずれかである必要があります。`);
  }
  if (typeof data.relocatable !== 'boolean') {
    throw new HttpsError('invalid-argument', 'relocatable は真偽値である必要があります。');
  }
  if (typeof data.prefecture !== 'string' || data.prefecture.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'prefecture は必須です。');
  }
  if (![1, 2, 3, 4, 5].includes(data.successionInterestLevel as number)) {
    throw new HttpsError('invalid-argument', 'successionInterestLevel は1〜5である必要があります。');
  }
  if (typeof data.fundingCapacity !== 'number' || data.fundingCapacity < 0) {
    throw new HttpsError('invalid-argument', 'fundingCapacity は0以上の数値である必要があります。');
  }
}

/** Creates or fully replaces the calling talent's own profile (doc id == uid). */
export const upsertTalent = onCall(async (request) => {
  const { uid } = requireRole(request, 'talent');
  const data = request.data ?? {};
  validateUpsert(data);

  const ref = db.collection('talents').doc(uid);
  const existing = await ref.get();

  const payload: Partial<Talent> = {
    uid,
    name: data.name,
    skills: data.skills,
    interestedIndustries: data.interestedIndustries,
    weeklyAvailableHours: data.weeklyAvailableHours,
    workStyle: data.workStyle,
    relocatable: data.relocatable,
    prefecture: data.prefecture,
    successionInterestLevel: data.successionInterestLevel,
    fundingCapacity: data.fundingCapacity,
    bio: data.bio ?? '',
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
  return { id: uid };
});

export const getTalent = onCall(async (request) => {
  requireAuth(request);
  const id = request.data?.id;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id は必須です。');
  const snap = await db.collection('talents').doc(id).get();
  if (!snap.exists) throw new HttpsError('not-found', '人材プロフィールが見つかりません。');
  return { id: snap.id, ...snap.data() };
});

export const listTalents = onCall(async (request) => {
  requireAuth(request);
  const limit = Math.min(Number(request.data?.limit) || 50, 200);
  const snap = await db.collection('talents').orderBy('createdAt', 'desc').limit(limit).get();
  return { talents: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
