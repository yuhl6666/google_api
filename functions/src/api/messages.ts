import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireAuth } from '../lib/auth';
import { Match } from '../types';

/**
 * Sends a chat message and atomically updates the parent match's engagement
 * counters (messageCount/first/lastMessageAt) in the same transaction, since
 * those aggregates directly feed the phase2→3 promotion score.
 *
 * Writing goes through this callable rather than a client-side Firestore
 * write so the counters can never drift out of sync with the message log;
 * reading is still done client-side via a plain Firestore onSnapshot
 * listener, which is what gives the chat screen its realtime updates
 * without needing a websocket of our own.
 */
export const sendMessage = onCall(async (request) => {
  const { uid, role } = requireAuth(request);
  const matchId = request.data?.matchId;
  const body = request.data?.body;

  if (typeof matchId !== 'string') throw new HttpsError('invalid-argument', 'matchId は必須です。');
  if (typeof body !== 'string' || body.trim().length === 0 || body.length > 4000) {
    throw new HttpsError('invalid-argument', 'body は1〜4000文字である必要があります。');
  }
  if (role !== 'talent' && role !== 'company') {
    throw new HttpsError('failed-precondition', 'talents/companies いずれかのロールが必要です。');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const messageRef = db.collection('messages').doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists) throw new HttpsError('not-found', 'マッチが見つかりません。');
    const match = snap.data() as Match;
    if (match.talentId !== uid && match.companyId !== uid) {
      throw new HttpsError('permission-denied', 'このマッチの当事者ではありません。');
    }

    tx.set(messageRef, {
      matchId,
      senderId: uid,
      senderRole: role,
      body: body.trim(),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(matchRef, {
      messageCount: (match.messageCount ?? 0) + 1,
      firstMessageAt: match.firstMessageAt ?? FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { id: messageRef.id };
});
