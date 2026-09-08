import { EngineerSkill } from '../types';

interface Props {
  skills: EngineerSkill[];
  onChange: (skills: EngineerSkill[]) => void;
}

export function EngineerSkillsEditor({ skills, onChange }: Props) {
  const update = (index: number, patch: Partial<EngineerSkill>) => {
    onChange(skills.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const remove = (index: number) => onChange(skills.filter((_, i) => i !== index));
  const add = () => onChange([...skills, { name: '', years: 0 }]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">保有スキル</label>
      {skills.map((skill, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="スキル名 (例: Java)"
            value={skill.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={0}
            placeholder="経験年数"
            value={skill.years}
            onChange={(e) => update(i, { years: Number(e.target.value) })}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
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
