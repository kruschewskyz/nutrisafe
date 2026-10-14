import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Favorites from './pages/Favorites';
import Meals from './pages/Meals';
import Profile from './pages/Profile';
import Progress from './pages/Progress';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center muted">Carregando…</div>;

  return (
    <Routes>
      {/* Rotas públicas: quem já está logado vai direto para o painel */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Rotas protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="meals" element={<Meals />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="progress" element={<Progress />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
