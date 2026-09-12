import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteProject, listProjects, runMatching } from '../api';
import { Project } from '../types';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { projects } = await listProjects();
      setProjects(projects);
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
    if (!confirm('この案件を削除しますか？')) return;
    await deleteProject(id);
    await load();
  };

  const handleRunMatching = async (id: string) => {
    setRunningId(id);
    try {
      const { count } = await runMatching({ projectId: id });
      alert(`${count}件の要員とマッチングを実行しました。`);
      navigate('/matches');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'マッチング実行に失敗しました');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">案件一覧</h1>
        <Link to="/projects/new" className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          + 案件を登録
        </Link>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-500">読み込み中...</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-500">案件が登録されていません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">案件名</th>
                <th className="px-4 py-2">必要スキル</th>
                <th className="px-4 py-2">単価</th>
                <th className="px-4 py-2">勤務地</th>
                <th className="px-4 py-2">稼働開始</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.requiredSkills.map((s) => s.name).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.rateMin}〜{p.rateMax}万円
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.location}
                    {p.remoteAllowed ? '（リモート可）' : ''}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.startDate}</td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleRunMatching(p.id)}
                      disabled={runningId === p.id}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {runningId === p.id ? '実行中...' : 'マッチング実行'}
                    </button>
                    <Link to={`/projects/${p.id}/edit`} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
                      編集
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id)}
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
