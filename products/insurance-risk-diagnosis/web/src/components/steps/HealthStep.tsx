import type { DiagnosisInput } from '../../types/diagnosis';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function HealthStep({ input, onChange }: Props) {
  const { health } = input;
  const update = (patch: Partial<typeof health>) => {
    onChange((draft) => ({ ...draft, health: { ...draft.health, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">健康状態</h2>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={health.hasMedicalHistory}
          onChange={(e) => update({ hasMedicalHistory: e.target.checked })}
        />
        過去に大きな病気・入院歴などの既往歴がある
      </label>
      <p className="text-xs text-slate-400 mt-2">
        ここでは簡易チェックのみ行います。詳細な告知内容は実際の保険申込時に確認されます。
      </p>
    </div>
  );
}
