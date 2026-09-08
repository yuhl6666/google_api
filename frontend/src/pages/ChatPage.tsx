import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Message } from '../types';

function formatTime(createdAt: unknown): string {
  if (createdAt instanceof Timestamp) return createdAt.toDate().toLocaleString('ja-JP');
  return '送信中...';
}

export function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId) return;
    // Realtime listener — no websocket setup needed, Firestore pushes updates directly.
    const q = query(collection(db, 'messages'), where('matchId', '==', matchId), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message));
    });
    return unsub;
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user || !matchId || !role) return;
    setError(null);
    try {
      await api.sendMessage(matchId, body.trim());
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h1 className="truncate text-sm font-semibold text-slate-900" title={matchId}>
          メッセージ ({matchId})
        </h1>
        <Link to={`/matches/${matchId}/phase`} className="shrink-0 text-xs text-slate-500 underline">
          フェーズ管理へ
        </Link>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
        {messages.map((m) => {
          const mine = m.senderId === user?.uid;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                <p>{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-slate-300' : 'text-slate-400'}`}>{formatTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-sm text-slate-400">まだメッセージはありません。</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          送信
        </button>
      </form>
    </div>
  );
}
