import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Match, PhaseHistoryEntry } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { StarRating } from '../components/StarRating';

const PHASE_LABEL: Record<number | string, string> = {
  1: 'フェーズ1',
  2: 'フェーズ2',
  3: 'フェーズ3',
  declined: '解消',
  completed: '承継成立',
};

function formatDate(ts: unknown): string {
  if (typeof ts === 'string') return new Date(ts).toLocaleString('ja-JP');
  return '-';
}

export function PhaseManagePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { role } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [history, setHistory] = useState<PhaseHistoryEntry[]>([]);
  const [evalResult, setEvalResult] = useState<{ eligible: boolean; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(5);

  const reload = useCallback(async () => {
    if (!matchId) return;
    const [matches1, matches2, matches3, h] = await Promise.all([
      api.listMatchesForCaller(1),
      api.listMatchesForCaller(2),
      api.listMatchesForCaller(3),
      api.listPhaseHistory(matchId),
    ]);
    const found = [...matches1.matches, ...matches2.matches, ...matches3.matches].find((m) => m.id === matchId) ?? null;
    setMatch(found);
    setHistory(h.history);
  }, [matchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleEvaluate() {
    if (!matchId) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.evaluatePhaseUpgrade(matchId);
      setEvalResult(r);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: 'promote' | 'decline' | 'complete') {
    if (!matchId) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.changePhase(matchId, action);
      setMessage(action === 'promote' ? `フェーズ${r.phase}に昇格しました。` : `ステータスを更新しました: ${r.status}`);
      setEvalResult(null);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExpressIntent() {
    if (!matchId) return;
    setBusy(true);
    try {
      await api.expressContinuationIntent(matchId);
      setMessage('継続希望を表明しました。');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleReview() {
    if (!matchId) return;
    setBusy(true);
    try {
      await api.submitReview(matchId, rating);
      setMessage('レビューを送信しました。');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!match) return <p className="p-6 text-sm text-slate-500">マッチが見つかりません。</p>;

  const myIntentGiven = role === 'talent' ? match.continuationIntent?.talent : match.continuationIntent?.company;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">フェーズ管理</h1>
        <Link to={`/matches/${matchId}/chat`} className="text-xs text-slate-500 underline">
          メッセージへ
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-600">{match.talentId} × {match.companyId}</span>
          <PhaseBadge phase={match.phase} status={match.status} />
        </div>
        <ScoreBreakdown breakdown={match.scoreBreakdown} />
      </div>

      {match.status === 'active' && match.phase === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">フェーズ2への昇格条件</h2>
          <p className="mb-2 text-xs text-slate-500">
            フェーズ1総合スコアが基準(60%)を超え、かつ双方が継続を希望すると昇格できます。
          </p>
          <div className="mb-3 flex gap-4 text-xs">
            <span>人材の継続希望: {match.continuationIntent?.talent ? '✅' : '未表明'}</span>
            <span>企業の継続希望: {match.continuationIntent?.company ? '✅' : '未表明'}</span>
          </div>
          {!myIntentGiven && (
            <button
              onClick={handleExpressIntent}
              disabled={busy}
              className="mr-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
            >
              継続を希望する
            </button>
          )}
        </div>
      )}

      {match.status === 'active' && match.phase === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">相互レビュー（フェーズ3昇格スコアに反映）</h2>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} />
            <button onClick={handleReview} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100">
              レビューを送信
            </button>
          </div>
        </div>
      )}

      {match.status === 'active' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">操作</h2>
          <div className="flex flex-wrap gap-2">
            {match.phase < 3 && (
              <button
                onClick={handleEvaluate}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
              >
                昇格判定を確認
              </button>
            )}
            {match.phase < 3 && (
              <button
                onClick={() => handleAction('promote')}
                disabled={busy}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                次のフェーズへ昇格
              </button>
            )}
            {match.phase === 3 && (
              <button
                onClick={() => handleAction('complete')}
                disabled={busy}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                承継成立にする
              </button>
            )}
            <button
              onClick={() => handleAction('decline')}
              disabled={busy}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              解消する
            </button>
          </div>
          {evalResult && (
            <p className={`mt-2 text-xs ${evalResult.eligible ? 'text-emerald-600' : 'text-slate-500'}`}>{evalResult.reason}</p>
          )}
          {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">フェーズ変更履歴</h2>
        {history.length === 0 && <p className="text-xs text-slate-400">履歴はまだありません。</p>}
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="border-l-2 border-slate-300 pl-3 text-xs text-slate-600">
              <span className="font-medium text-slate-900">
                {h.fromPhase ? PHASE_LABEL[h.fromPhase] : '開始'} → {PHASE_LABEL[h.toPhase]}
              </span>
              <span className="ml-2 text-slate-400">{formatDate(h.createdAt)}</span>
              <p>{h.reason}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
