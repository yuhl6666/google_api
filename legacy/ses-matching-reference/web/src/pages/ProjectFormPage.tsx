import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProject, getProject, updateProject } from '../api';
import { RequiredSkillsEditor } from '../components/RequiredSkillsEditor';
import { JAPANESE_LEVEL_LABELS, JapaneseLevel, Project, RequiredSkill } from '../types';

const emptyProject: Omit<Project, 'id'> = {
  name: '',
  requiredSkills: [],
  rateMin: 0,
  rateMax: 0,
  location: '',
  remoteAllowed: false,
  startDate: '',
  durationMonths: null,
  commercialTier: null,
  japaneseLevel: 'none',
  sourceEmailBody: '',
};

export function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Project, 'id'>>(emptyProject);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then(({ project }) => setForm(project))
      .finally(() => setLoading(false));
  }, [id]);

  const setSkills = (requiredSkills: RequiredSkill[]) => setForm((f) => ({ ...f, requiredSkills }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateProject(id, form);
      } else {
        await createProject(form);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">読み込み中...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-slate-800">{isEdit ? '案件を編集' : '案件を登録'}</h1>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">案件名</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <RequiredSkillsEditor skills={form.requiredSkills} onChange={setSkills} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">単価下限(万円)</label>
            <input
              type="number"
              required
              min={0}
              value={form.rateMin}
              onChange={(e) => setForm({ ...form, rateMin: Number(e.target.value) })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">単価上限(万円)</label>
            <input
              type="number"
              required
              min={0}
              value={form.rateMax}
              onChange={(e) => setForm({ ...form, rateMax: Number(e.target.value) })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">勤務地</label>
            <input
              required
              placeholder="例: 東京都 / リモート"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.remoteAllowed}
                onChange={(e) => setForm({ ...form, remoteAllowed: e.target.checked })}
              />
              リモート可
            </label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">稼働開始日</label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">期間(ヶ月)</label>
            <input
              type="number"
              min={0}
              value={form.durationMonths ?? ''}
              onChange={(e) => setForm({ ...form, durationMonths: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">商流(何次請け)</label>
            <input
              type="number"
              min={1}
              value={form.commercialTier ?? ''}
              onChange={(e) => setForm({ ...form, commercialTier: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">日本語レベル要件</label>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">元メール本文（貼り付け）</label>
          <textarea
            rows={5}
            value={form.sourceEmailBody}
            onChange={(e) => setForm({ ...form, sourceEmailBody: e.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="案件情報メールの本文をそのまま貼り付けてください"
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
            onClick={() => navigate('/')}
            className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
