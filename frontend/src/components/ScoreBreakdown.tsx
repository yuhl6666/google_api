import { ScoreBreakdown as ScoreBreakdownType } from '../types';

function Bar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-0.5 h-2 w-full rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Shows the score breakdown for whichever phase the match currently sits in, plus the overall total. */
export function ScoreBreakdown({ breakdown }: { breakdown: ScoreBreakdownType }) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">総合スコア</span>
        <span className="text-lg font-bold text-slate-900">{Math.round(breakdown.currentTotal * 100)}%</span>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">フェーズ1: 副業適合度</p>
        <div className="space-y-1.5">
          <Bar label="スキル適合" value={breakdown.phase1.skillFit} colorClass="bg-sky-500" />
          <Bar label="稼働条件適合" value={breakdown.phase1.workloadFit} colorClass="bg-sky-500" />
          <Bar label="業種興味度" value={breakdown.phase1.industryFit} colorClass="bg-sky-500" />
          <Bar label="地域マッチ" value={breakdown.phase1.regionFit} colorClass="bg-sky-500" />
        </div>
      </div>

      {breakdown.phase2to3 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">フェーズ2→3 昇格スコア</p>
          <div className="space-y-1.5">
            <Bar label="関与期間" value={breakdown.phase2to3.engagementDurationScore} colorClass="bg-violet-500" />
            <Bar label="メッセージ量" value={breakdown.phase2to3.messageVolumeScore} colorClass="bg-violet-500" />
            <Bar label="相互レビュー" value={breakdown.phase2to3.reviewScore} colorClass="bg-violet-500" />
            <Bar label="フェーズ1引継ぎ" value={breakdown.phase2to3.phase1Carryover} colorClass="bg-violet-500" />
          </div>
        </div>
      )}

      {breakdown.phase3 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">フェーズ3: 承継本気度</p>
          <div className="space-y-1.5">
            <Bar label="承継本気度" value={breakdown.phase3.successionSeriousness} colorClass="bg-amber-500" />
            <Bar label="資金力適合" value={breakdown.phase3.fundingFit} colorClass="bg-amber-500" />
            <Bar label="承継時期の近さ" value={breakdown.phase3.timingFit} colorClass="bg-amber-500" />
            <Bar label="地域マッチ" value={breakdown.phase3.regionFit} colorClass="bg-amber-500" />
          </div>
        </div>
      )}
    </div>
  );
}
