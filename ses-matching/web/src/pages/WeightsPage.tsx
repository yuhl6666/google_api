import { useEffect, useState } from 'react';
import { getWeights, putWeights } from '../api';
import { ScoreWeights } from '../types';

const LABELS: Record<keyof ScoreWeights, string> = {
  skillWeight: 'スキル一致',
  rateWeight: '単価一致',
  locationWeight: '勤務地/リモート一致',
  timingWeight: '稼働時期一致',
};

export function WeightsPage() {
  const [weights, setWeights] = useState<ScoreWeights | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getWeights().then(({ weights }) => setWeights(weights));
  }, []);

  if (!weights) return <p className="text-slate-500">読み込み中...</p>;

  const total = weights.skillWeight + weights.rateWeight + weights.locationWeight + weights.timingWeight;

  const handleChange = (key: keyof ScoreWeights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { weights: saved } = await putWeights(weights);
      setWeights(saved);
      setMessage('保存しました（自動的に合計100%になるよう正規化されます）。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-xl font-bold text-slate-800">重み調整設定</h1>
      <p className="mb-4 text-sm text-slate-500">
        マッチングスコアの各評価軸の重みを調整できます。フィードバック（採用/却下）が蓄積されると、傾向に応じて自動的にも微調整されます。
      </p>

      {message && <p className="mb-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

      <div className="space-y-5 rounded-lg border bg-white p-6">
        {(Object.keys(LABELS) as (keyof ScoreWeights)[]).map((key) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <label className="font-medium text-slate-700">{LABELS[key]}</label>
              <span className="text-slate-500">{Math.round((weights[key] / total) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights[key]}
              onChange={(e) => handleChange(key, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
