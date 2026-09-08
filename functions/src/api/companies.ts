import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireRole, requireAuth } from '../lib/auth';
import { Company, FinancialHealth, SuccessionTimeframe } from '../types';

const FINANCIAL_HEALTHS: FinancialHealth[] = ['good', 'average', 'needs_improvement'];
const TIMEFRAMES: SuccessionTimeframe[] = ['immediate', '1-3y', '3-5y', '5y+'];

interface UpsertCompanyInput {
  name: string;
  industry: string;
  prefecture: string;
  overview: string;
  financialHealth: FinancialHealth;
  wantedPersonaTags: string[];
  wantedPersonaTagWeights?: Record<string, number>;
  sideJobAcceptable: boolean;
  requiredWeeklyHours: { min: number; max: number };
  successionTimeframe: SuccessionTimeframe;
}

function validateUpsert(data: Partial<UpsertCompanyInput>): asserts data is UpsertCompanyInput {
  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'name は必須です。');
  }
  if (typeof data.industry !== 'string' || data.industry.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'industry は必須です。');
  }
  if (typeof data.prefecture !== 'string' || data.prefecture.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'prefecture は必須です。');
  }
  if (typeof data.overview !== 'string') {
    throw new HttpsError('invalid-argument', 'overview は必須です。');
  }
  if (!data.financialHealth || !FINANCIAL_HEALTHS.includes(data.financialHealth)) {
    throw new HttpsError('invalid-argument', `financialHealth は ${FINANCIAL_HEALTHS.join('/')} のいずれかである必要があります。`);
  }
  if (!Array.isArray(data.wantedPersonaTags) || !data.wantedPersonaTags.every((s) => typeof s === 'string')) {
    throw new HttpsError('invalid-argument', 'wantedPersonaTags は文字列配列である必要があります。');
  }
  if (typeof data.sideJobAcceptable !== 'boolean') {
    throw new HttpsError('invalid-argument', 'sideJobAcceptable は真偽値である必要があります。');
  }
  const range = data.requiredWeeklyHours;
  if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || range.min > range.max) {
    throw new HttpsError('invalid-argument', 'requiredWeeklyHours.min/max が不正です。');
  }
  if (!data.successionTimeframe || !TIMEFRAMES.includes(data.successionTimeframe)) {
    throw new HttpsError('invalid-argument', `successionTimeframe は ${TIMEFRAMES.join('/')} のいずれかである必要があります。`);
  }
}

/** Creates or fully replaces the calling company's own profile (doc id == uid). */
export const upsertCompany = onCall(async (request) => {
  const { uid } = requireRole(request, 'company');
  const data = request.data ?? {};
  validateUpsert(data);

  const ref = db.collection('companies').doc(uid);
  const existing = await ref.get();

  const payload: Partial<Company> = {
    uid,
    name: data.name,
    industry: data.industry,
    prefecture: data.prefecture,
    overview: data.overview,
    financialHealth: data.financialHealth,
    wantedPersonaTags: data.wantedPersonaTags,
    wantedPersonaTagWeights: data.wantedPersonaTagWeights ?? {},
    sideJobAcceptable: data.sideJobAcceptable,
    requiredWeeklyHours: data.requiredWeeklyHours,
    successionTimeframe: data.successionTimeframe,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
  return { id: uid };
});

export const getCompany = onCall(async (request) => {
  requireAuth(request);
  const id = request.data?.id;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id は必須です。');
  const snap = await db.collection('companies').doc(id).get();
  if (!snap.exists) throw new HttpsError('not-found', '企業プロフィールが見つかりません。');
  return { id: snap.id, ...snap.data() };
});

export const listCompanies = onCall(async (request) => {
  requireAuth(request);
  const limit = Math.min(Number(request.data?.limit) || 50, 200);
  const snap = await db.collection('companies').orderBy('createdAt', 'desc').limit(limit).get();
  return { companies: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
