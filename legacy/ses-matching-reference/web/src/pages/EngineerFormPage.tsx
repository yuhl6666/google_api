import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createEngineer, getEngineer, updateEngineer } from '../api';
import { EngineerSkillsEditor } from '../components/EngineerSkillsEditor';
import { Engineer, EngineerSkill, JAPANESE_LEVEL_LABELS, JapaneseLevel } from '../types';

const emptyEngineer: Omit<Engineer, 'id'> = {
  name: '',
  skills: [],
  desiredRateMin: 0,
  desiredRateMax: 0,
  desiredLocations: [],
  remoteDesired: false,
  availableFrom: '',
  japaneseLevel: 'none',
  sourceSkillSheetBody: '',
};

export function EngineerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Engineer, 'id'>>(emptyEngineer);
  const [locationsText, setLocationsText] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEngineer(id)
      .then(({ engineer }) => {
        setForm(engineer);
        setLocationsText(engineer.desiredLocations.join(', '));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const setSkills = (skills: EngineerSkill[]) => setForm((f) => ({ ...f, skills }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const desiredLocations = locationsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { ...form, desiredLocations };
    try {
      if (isEdit && id) {
        await updateEngineer(id, payload);
      } else {
        await createEngineer(payload);
      }
      navigate('/engineers');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">読み込み中...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-slate-800">{isEdit ? '要員を編集' : '要員を登録'}</h1>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">氏名/コード</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <EngineerSkillsEditor skills={form.skills} onChange={setSkills} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">希望単価下限(万円)</label>
            <input
              type="number"
              required
              min={0}
              value={form.desiredRateMin}
              onChange={(e) => setForm({ ...form, desiredRateMin: Number(e.target.value) })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">希望単価上限(万円)</label>
            <input
              type="number"
              required
              min={0}
              value={form.desiredRateMax}
              onChange={(e) => setForm({ ...form, desiredRateMax: Number(e.target.value) })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">希望勤務地(カンマ区切り)</label>
            <input
              placeholder="例: 東京都, 神奈川県"
              value={locationsText}
              onChange={(e) => setLocationsText(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.remoteDesired}
                onChange={(e) => setForm({ ...form, remoteDesired: e.target.checked })}
              />
              リモート希望
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">稼働可能日</label>
            <input
              type="date"
              required
              value={form.availableFrom}
              onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">日本語レベル</label>
            <select
              value={form.japaneseLevel}
              onChange={(e) => setForm({ ...form, japaneseLevel: e.target.value as JapaneseLevel })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.entries(JAPANESE_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">元スキルシート本文（貼り付け）</label>
          <textarea
            rows={5}
            value={form.sourceSkillSheetBody}
            onChange={(e) => setForm({ ...form, sourceSkillSheetBody: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="スキルシートの本文をそのまま貼り付けてください"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/engineers')}
            className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
