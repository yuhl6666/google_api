import { MatchPhase, MatchStatus } from '../types';

const PHASE_LABEL: Record<MatchPhase, string> = {
  1: 'フェーズ1: 副業お試し',
  2: 'フェーズ2: 関係深化',
  3: 'フェーズ3: 承継検討',
};

const PHASE_COLOR: Record<MatchPhase, string> = {
  1: 'bg-sky-100 text-sky-800 border-sky-300',
  2: 'bg-violet-100 text-violet-800 border-violet-300',
  3: 'bg-amber-100 text-amber-800 border-amber-300',
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  active: '進行中',
  declined: '解消',
  completed: '承継成立',
};

export function PhaseBadge({ phase, status }: { phase: MatchPhase; status?: MatchStatus }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${PHASE_COLOR[phase]}`}>
        {PHASE_LABEL[phase]}
      </span>
      {status && status !== 'active' && (
        <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {STATUS_LABEL[status]}
        </span>
      )}
    </div>
  );
}
