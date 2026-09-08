import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Company, FinancialHealth, SuccessionTimeframe } from '../types';

const EMPTY: Omit<Company, 'id' | 'uid'> = {
  name: '',
  industry: '',
  prefecture: '',
  overview: '',
  financialHealth: 'average',
  wantedPersonaTags: [],
  sideJobAcceptable: true,
  requiredWeeklyHours: { min: 5, max: 15 },
  successionTimeframe: '1-3y',
};

function CompanyForm() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .getCompany(user.id)
      .then((c) => {
        setForm(c);
        setTagsText(c.wantedPersonaTags.join(', '));
      })
      .catch(() => {
        /* not registered yet */
      });
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.upsertCompany({
        ...form,
        wantedPersonaTags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setMessage('保存しました。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">企業プロフィール登録</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">会社名</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">業種</label>
          <input
            required
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            placeholder="製造業"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">所在地（都道府県）</label>
          <input
            required
            value={form.prefecture}
            onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
            placeholder="長野県"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">経営状況</label>
          <select
            value={form.financialHealth}
            onChange={(e) => setForm({ ...form, financialHealth: e.target.value as FinancialHealth })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="good">良好</option>
            <option value="average">普通</option>
            <option value="needs_improvement">要改善</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">事業概要</label>
        <textarea
          required
          rows={2}
          value={form.overview}
          onChange={(e) => setForm({ ...form, overview: e.target.value })}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">求める人物像タグ（カンマ区切り）</label>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="経理, EC運営, Webマーケ"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 pt-5">
          <input
            id="sideJob"
            type="checkbox"
            checked={form.sideJobAcceptable}
            onChange={(e) => setForm({ ...form, sideJobAcceptable: e.target.checked })}
          />
          <label htmlFor="sideJob" className="text-xs font-medium text-slate-600">
            副業からの受け入れ可
          </label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">承継希望時期</label>
          <select
            value={form.successionTimeframe}
            onChange={(e) => setForm({ ...form, successionTimeframe: e.target.value as SuccessionTimeframe })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="immediate">今すぐ</option>
            <option value="1-3y">1〜3年以内</option>
            <option value="3-5y">3〜5年以内</option>
            <option value="5y+">5年以上先</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">受け入れ可能時間/週（最小）</label>
          <input
            type="number"
            min={0}
            value={form.requiredWeeklyHours.min}
            onChange={(e) => setForm({ ...form, requiredWeeklyHours: { ...form.requiredWeeklyHours, min: Number(e.target.value) } })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">受け入れ可能時間/週（最大）</label>
          <input
            type="number"
            min={0}
            value={form.requiredWeeklyHours.max}
            onChange={(e) => setForm({ ...form, requiredWeeklyHours: { ...form.requiredWeeklyHours, max: Number(e.target.value) } })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        保存する
      </button>
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </form>
  );
}

function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listCompanies()
      .then((r) => setCompanies(r.companies))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">読み込み中...</p>;

  return (
    <div className="space-y-3">
      {companies.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{c.name}</h3>
            <span className="text-xs text-slate-500">
              {c.industry} / {c.prefecture}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            副業受け入れ: {c.sideJobAcceptable ? '可' : '不可'} / 承継希望時期:{' '}
            {{ immediate: '今すぐ', '1-3y': '1〜3年以内', '3-5y': '3〜5年以内', '5y+': '5年以上先' }[c.successionTimeframe]}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.wantedPersonaTags.map((t) => (
              <span key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-600">{c.overview}</p>
        </div>
      ))}
      {companies.length === 0 && <p className="text-sm text-slate-500">登録されている企業がまだいません。</p>}
    </div>
  );
}

export function CompaniesPage() {
  const { role } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {role === 'company' && <CompanyForm />}
      <div>
        <h2 className="mb-3 font-semibold text-slate-900">企業一覧</h2>
        <CompanyList />
      </div>
    </div>
  );
}
