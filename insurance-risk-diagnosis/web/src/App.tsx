import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DiagnosisFormPage } from './pages/DiagnosisFormPage';
import { ResultPage } from './pages/ResultPage';
import { HistoryPage } from './pages/HistoryPage';
import { RequireAuth } from './components/auth/RequireAuth';

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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
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
    </div>
  );
}
