import { useEffect, useMemo, useState } from 'react';
import { listMatches, runMatching, submitFeedback, updateMatchStatus } from '../api';
import { MatchResult, MatchStatus } from '../types';

const STATUS_OPTIONS: MatchStatus[] = ['未対応', '提案済', '成約', '却下'];

const STATUS_COLORS: Record<MatchStatus, string> = {
  未対応: 'bg-slate-100 text-slate-700',
  提案済: 'bg-blue-100 text-blue-700',
  成約: 'bg-emerald-100 text-emerald-700',
  却下: 'bg-red-100 text-red-700',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-500">{label}</span>
      <div className="h-2 flex-1 rounded bg-slate-100">
        <div className="h-2 rounded bg-blue-500" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-slate-600">{Math.round(value * 100)}%</span>
    </div>
  );
}

export function MatchesPage() {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MatchStatus | ''>('');
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { matches } = await listMatches(statusFilter ? { status: statusFilter } : undefined);
      setMatches(matches.sort((a, b) => b.totalScore - a.totalScore));
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      const { count } = await runMatching({});
      alert(`${count}件のマッチングを再計算しました。`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'マッチング実行に失敗しました');
    } finally {
      setRunning(false);
    }
  };

  const handleStatusChange = async (id: string, status: MatchStatus) => {
    await updateMatchStatus(id, status);
    await load();
  };

  const handleFeedback = async (id: string, decision: '採用' | '却下') => {
    const reasonNote = prompt(`${decision}の理由メモ(任意)を入力してください`) ?? '';
    try {
      await submitFeedback({ matchId: id, decision, reasonNote });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'フィードバック登録に失敗しました');
    }
  };

  const sortedMatches = useMemo(() => matches, [matches]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">マッチング結果</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MatchStatus | '')}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべてのステータス</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleRunAll}
            disabled={running}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {running ? '実行中...' : '全件マッチングを再計算'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">読み込み中...</p>
      ) : sortedMatches.length === 0 ? (
        <p className="text-slate-500">マッチング結果がありません。案件一覧から「マッチング実行」を行ってください。</p>
      ) : (
        <div className="space-y-2">
          {sortedMatches.map((m) => (
            <div key={m.id} className="rounded-lg border bg-white">
              <button
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold ${scoreColor(m.totalScore)}`}>{m.totalScore}</span>
                  <div>
                    <p className="font-medium text-slate-800">
                      {m.projectName} × {m.engineerName}
                    </p>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[m.status]}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
                <span className="text-slate-400">{expandedId === m.id ? '▲ 閉じる' : '▼ スコア内訳を見る'}</span>
              </button>

              {expandedId === m.id && (
                <div className="border-t px-4 py-3">
                  <div className="mb-3 space-y-1.5">
                    <ScoreBar label="スキル" value={m.scoreBreakdown.skillScore} />
                    <ScoreBar label="単価" value={m.scoreBreakdown.rateScore} />
                    <ScoreBar label="勤務地" value={m.scoreBreakdown.locationScore} />
                    <ScoreBar label="稼働時期" value={m.scoreBreakdown.timingScore} />
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    重み: スキル{Math.round(m.scoreBreakdown.weightsUsed.skillWeight * 100)}% / 単価
                    {Math.round(m.scoreBreakdown.weightsUsed.rateWeight * 100)}% / 勤務地
                    {Math.round(m.scoreBreakdown.weightsUsed.locationWeight * 100)}% / 稼働時期
                    {Math.round(m.scoreBreakdown.weightsUsed.timingWeight * 100)}%
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusChange(m.id, e.target.value as MatchStatus)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleFeedback(m.id, '採用')}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      採用にする
                    </button>
                    <button
                      onClick={() => handleFeedback(m.id, '却下')}
                      className="rounded bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                    >
                      却下にする
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
