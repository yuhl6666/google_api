import { RequiredSkill } from '../types';

interface Props {
  skills: RequiredSkill[];
  onChange: (skills: RequiredSkill[]) => void;
}

export function RequiredSkillsEditor({ skills, onChange }: Props) {
  const update = (index: number, patch: Partial<RequiredSkill>) => {
    onChange(skills.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const remove = (index: number) => onChange(skills.filter((_, i) => i !== index));
  const add = () => onChange([...skills, { name: '', minYears: 0, required: true }]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">必要スキル</label>
      {skills.map((skill, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="スキル名 (例: React)"
            value={skill.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={0}
            placeholder="最低経験年数"
            value={skill.minYears}
            onChange={(e) => update(i, { minYears: Number(e.target.value) })}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={skill.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            必須
          </label>
          <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:underline">
            削除
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium text-blue-600 hover:underline">
        + スキルを追加
      </button>
    </div>
  );
}
