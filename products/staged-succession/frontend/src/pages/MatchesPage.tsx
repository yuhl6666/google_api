import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Match, MatchPhase } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';

const TABS: { phase: MatchPhase; label: string }[] = [
  { phase: 1, label: 'フェーズ1: 副業お試し' },
  { phase: 2, label: 'フェーズ2: 関係深化' },
  { phase: 3, label: 'フェーズ3: 承継検討' },
];

export function MatchesPage() {
  const [phase, setPhase] = useState<MatchPhase>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(p: MatchPhase) {
    setLoading(true);
    try {
      const r = await api.listMatchesForCaller(p);
      setMatches(r.matches);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(phase);
  }, [phase]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      const r = await api.refreshMatchesForCaller();
      setMessage(`${r.matched}件の候補を再計算しました。`);
      await load(phase);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">マッチング候補</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {refreshing ? '計算中...' : '候補を再計算'}
        </button>
      </div>
      {message && <p className="mb-3 text-sm text-slate-600">{message}</p>}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.phase}
            onClick={() => setPhase(t.phase)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              phase === t.phase ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-slate-500">このフェーズの候補はまだありません。「候補を再計算」を押してください。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matches.map((m) => (
            <div key={m.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{m.talentId} × {m.companyId}</span>
                <PhaseBadge phase={m.phase} status={m.status} />
              </div>
              <ScoreBreakdown breakdown={m.scoreBreakdown} />
              <div className="flex gap-2">
                <Link
                  to={`/matches/${m.id}/chat`}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-center text-xs font-medium hover:bg-slate-100"
                >
                  メッセージ
                </Link>
                <Link
                  to={`/matches/${m.id}/phase`}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-center text-xs font-medium hover:bg-slate-100"
                >
                  フェーズ管理
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
