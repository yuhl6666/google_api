import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass } from './FormField';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function InsuranceStep({ input, onChange }: Props) {
  const { existingInsurance } = input;
  const update = (patch: Partial<typeof existingInsurance>) => {
    onChange((draft) => ({ ...draft, existingInsurance: { ...draft.existingInsurance, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">既存保険</h2>

      <FormField label="既存の死亡保障額の合計(万円)">
        <input
          type="number"
          min={0}
          className={inputClass}
          value={existingInsurance.deathCoverage}
          onChange={(e) => update({ deathCoverage: Number(e.target.value) })}
        />
      </FormField>

      <div className="space-y-2 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={existingInsurance.hasMedicalCoverage}
            onChange={(e) => update({ hasMedicalCoverage: e.target.checked })}
          />
          医療保険に加入している
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={existingInsurance.hasDisabilityCoverage}
            onChange={(e) => update({ hasDisabilityCoverage: e.target.checked })}
          />
          就業不能保険に加入している
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={existingInsurance.hasSavingsTypeCoverage}
            onChange={(e) => update({ hasSavingsTypeCoverage: e.target.checked })}
          />
          資産形成型の保険に加入している
        </label>
      </div>
    </div>
  );
}
