import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export type Role = 'talent' | 'company';

/** Throws HttpsError('unauthenticated') if there's no signed-in caller. */
export function requireAuth(request: CallableRequest): { uid: string; role?: Role } {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'サインインが必要です。');
  }
  return { uid: auth.uid, role: auth.token.role as Role | undefined };
}

/** Throws HttpsError('permission-denied') if the caller's role claim doesn't match. */
export function requireRole(request: CallableRequest, role: Role): { uid: string } {
  const { uid, role: actual } = requireAuth(request);
  if (actual !== role) {
    throw new HttpsError('permission-denied', `この操作には ${role} ロールが必要です。`);
  }
  return { uid };
}
