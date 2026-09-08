import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DiagnosisFormPage = lazy(() => import('./pages/DiagnosisFormPage').then((m) => ({ default: m.DiagnosisFormPage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));

function Header() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/diagnosis" className="font-semibold text-slate-800">
          保険リスク診断ツール
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{user.email}</span>
          <button onClick={() => signOut()} className="text-indigo-600 hover:underline">
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}

function PageFallback() {
  return <p className="text-center text-slate-500 py-8">読み込み中...</p>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/diagnosis"
            element={
              <RequireAuth>
                <DiagnosisFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/result/:id"
            element={
              <RequireAuth>
                <ResultPage />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/diagnosis" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
