import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEngineer, listEngineers } from '../api';
import { Engineer } from '../types';

export function EngineersPage() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { engineers } = await listEngineers();
      setEngineers(engineers);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('この要員を削除しますか？')) return;
    await deleteEngineer(id);
    await load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">要員一覧</h1>
        <Link
          to="/engineers/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + 要員を登録
        </Link>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-500">読み込み中...</p>
      ) : engineers.length === 0 ? (
        <p className="text-slate-500">要員が登録されていません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">氏名/コード</th>
                <th className="px-4 py-2">保有スキル</th>
                <th className="px-4 py-2">希望単価</th>
                <th className="px-4 py-2">希望勤務地</th>
                <th className="px-4 py-2">稼働可能日</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {engineers.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{e.name}</td>
                  <td className="px-4 py-2 text-slate-600">{e.skills.map((s) => s.name).join(', ') || '-'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {e.desiredRateMin}〜{e.desiredRateMax}万円
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {e.desiredLocations.join(', ')}
                    {e.remoteDesired ? '（リモート希望）' : ''}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{e.availableFrom}</td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <Link to={`/engineers/${e.id}/edit`} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                      編集
                    </Link>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
