import type { ScoreResult } from '../../types/diagnosis';

export function ScoreReasons({ title, score }: { title: string; score: ScoreResult }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <span className="text-2xl font-bold text-indigo-700">{Math.round(score.score)}点</span>
      </div>
      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
        {score.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
