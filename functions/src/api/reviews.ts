import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireAuth } from '../lib/auth';
import { Match } from '../types';

/**
 * Simple mutual 5-scale review, one per side per match. Feeds directly into
 * the phase2→3 promotion score (computeReviewScore).
 */
export const submitReview = onCall(async (request) => {
  const { uid, role } = requireAuth(request);
  const matchId = request.data?.matchId;
  const rating = request.data?.rating;
  const comment = typeof request.data?.comment === 'string' ? request.data.comment : '';

  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');
  if (![1, 2, 3, 4, 5].includes(rating)) throw new HttpsError('invalid-argument', 'rating は1〜5である必要があります。');

  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
  const match = snap.data() as Match;

  if (match.talentId !== uid && match.companyId !== uid) {
    throw new HttpsError('permission-denied', 'このマッチの当事者ではありません。');
  }

  const isTalentSide = role === 'talent' && match.talentId === uid;
  const isCompanySide = role === 'company' && match.companyId === uid;
  if (!isTalentSide && !isCompanySide) {
    throw new HttpsError('permission-denied', 'ロールとマッチの当事者が一致しません。');
  }

  const update = isTalentSide
    ? { 'reviews.talentRating': rating, 'reviews.talentComment': comment }
    : { 'reviews.companyRating': rating, 'reviews.companyComment': comment };

  await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
