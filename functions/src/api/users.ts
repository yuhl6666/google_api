import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { requireAuth } from '../lib/auth';

/**
 * Sets the role custom claim (talent | company) for the calling user right
 * after signup. Firestore security rules key off this claim to decide who
 * may write to talents/{uid} vs companies/{uid}. A user may only set their
 * own role, and only once (subsequent calls are rejected) to prevent a
 * talent from later granting themselves company write access or vice versa.
 */
export const setUserRole = onCall(async (request) => {
  const { uid } = requireAuth(request);
  const role = request.data?.role;
  if (role !== 'talent' && role !== 'company') {
    throw new HttpsError('invalid-argument', 'role は "talent" または "company" である必要があります。');
  }

  const auth = getAuth();
  const user = await auth.getUser(uid);
  if (user.customClaims?.role && user.customClaims.role !== role) {
    throw new HttpsError('failed-precondition', 'ロールは変更できません。');
  }

  await auth.setCustomUserClaims(uid, { ...user.customClaims, role });
  return { role };
});
