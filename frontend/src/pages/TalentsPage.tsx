import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Talent, WorkStyle } from '../types';

const EMPTY: Omit<Talent, 'id' | 'uid'> = {
  name: '',
  skills: [],
  interestedIndustries: [],
  weeklyAvailableHours: 5,
  workStyle: 'both',
  relocatable: false,
  prefecture: '',
  successionInterestLevel: 3,
  fundingCapacity: 0,
  bio: '',
};

function TalentForm() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [skillsText, setSkillsText] = useState('');
  const [industriesText, setIndustriesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .getTalent(user.uid)
      .then((t) => {
        setForm(t);
        setSkillsText(t.skills.join(', '));
        setIndustriesText(t.interestedIndustries.join(', '));
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
      await api.upsertTalent({
        ...form,
        skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
        interestedIndustries: industriesText.split(',').map((s) => s.trim()).filter(Boolean),
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
      <h2 className="font-semibold text-slate-900">人材プロフィール登録</h2>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">氏名</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">スキル/経験（カンマ区切り）</label>
        <input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="経理, EC運営, Webマーケ"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">興味のある業種（カンマ区切り）</label>
        <input
          value={industriesText}
          onChange={(e) => setIndustriesText(e.target.value)}
          placeholder="製造業, 農業"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">週の稼働可能時間</label>
          <input
            type="number"
            min={0}
            value={form.weeklyAvailableHours}
            onChange={(e) => setForm({ ...form, weeklyAvailableHours: Number(e.target.value) })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">希望勤務形態</label>
          <select
            value={form.workStyle}
            onChange={(e) => setForm({ ...form, workStyle: e.target.value as WorkStyle })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="remote">リモート</option>
            <option value="onsite">現地</option>
            <option value="both">どちらも可</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">拠点都道府県</label>
          <input
            required
            value={form.prefecture}
            onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
            placeholder="東京都"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="relocatable"
            type="checkbox"
            checked={form.relocatable}
            onChange={(e) => setForm({ ...form, relocatable: e.target.checked })}
          />
          <label htmlFor="relocatable" className="text-xs font-medium text-slate-600">
            移住可能
          </label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">事業承継への関心度（1〜5）</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.successionInterestLevel}
            onChange={(e) =>
              setForm({ ...form, successionInterestLevel: Number(e.target.value) as Talent['successionInterestLevel'] })
            }
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">資金余力の目安（万円）</label>
          <input
            type="number"
            min={0}
            value={form.fundingCapacity}
            onChange={(e) => setForm({ ...form, fundingCapacity: Number(e.target.value) })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">自己紹介</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
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

function TalentList() {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listTalents()
      .then((r) => setTalents(r.talents))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">読み込み中...</p>;

  return (
    <div className="space-y-3">
      {talents.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{t.name}</h3>
            <span className="text-xs text-slate-500">{t.prefecture}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            週{t.weeklyAvailableHours}時間 / {t.workStyle === 'remote' ? 'リモート' : t.workStyle === 'onsite' ? '現地' : 'リモート/現地どちらも可'}{' '}
            / 承継関心度 {t.successionInterestLevel}/5
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {t.skills.map((s) => (
              <span key={s} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                {s}
              </span>
            ))}
          </div>
          {t.bio && <p className="mt-2 text-sm text-slate-600">{t.bio}</p>}
        </div>
      ))}
      {talents.length === 0 && <p className="text-sm text-slate-500">登録されている人材がまだいません。</p>}
    </div>
  );
}

export function TalentsPage() {
  const { role } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {role === 'talent' && <TalentForm />}
      <div>
        <h2 className="mb-3 font-semibold text-slate-900">人材一覧</h2>
        <TalentList />
      </div>
    </div>
  );
}
