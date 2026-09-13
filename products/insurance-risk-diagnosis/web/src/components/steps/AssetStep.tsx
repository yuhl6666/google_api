import type { DiagnosisInput } from '../../types/diagnosis';
import { FormField, inputClass, selectClass } from './FormField';

interface Props {
  input: DiagnosisInput;
  onChange: (updater: (draft: DiagnosisInput) => DiagnosisInput) => void;
}

export function AssetStep({ input, onChange }: Props) {
  const { asset } = input;
  const updateAsset = (patch: Partial<typeof asset>) => {
    onChange((draft) => ({ ...draft, asset: { ...draft.asset, ...patch } }));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">資産・負債</h2>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="貯蓄額(万円)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={asset.savings}
            onChange={(e) => updateAsset({ savings: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="保有資産(万円)" hint="住宅以外の投資・保険積立等">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={asset.otherAssets}
            onChange={(e) => updateAsset({ otherAssets: Number(e.target.value) })}
          />
        </FormField>

        <FormField label="住宅ローン残高(万円)">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={asset.mortgageBalance}
            onChange={(e) => updateAsset({ mortgageBalance: Number(e.target.value) })}
          />
        </FormField>

        {asset.mortgageBalance > 0 && (
          <FormField label="団体信用生命保険(団信)加入" hint="加入していれば死亡時にローン残高は保障の対象外になります">
            <select
              className={selectClass}
              value={asset.hasMortgageLifeInsurance ? 'yes' : 'no'}
              onChange={(e) => updateAsset({ hasMortgageLifeInsurance: e.target.value === 'yes' })}
            >
              <option value="yes">加入している</option>
              <option value="no">加入していない</option>
            </select>
          </FormField>
        )}
      </div>
    </div>
  );
}
