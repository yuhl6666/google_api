import { NextFunction, Request, Response } from 'express';
import { auth } from '../../firestoreAdmin';

export interface AuthedRequest extends Request {
  uid?: string;
  userEmail?: string;
}

/**
 * Authorization: Bearer <Firebase ID Token> を検証するミドルウェア。
 * 社内利用前提のツールのため、有効なFirebase Authユーザーであれば
 * 全員が全APIにアクセス可能とする（ロール分けは行わない）。
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    res.status(401).json({ error: 'Authorizationヘッダーが必要です' });
    return;
  }
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    req.uid = decoded.uid;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ error: '認証トークンが無効です' });
  }
}
