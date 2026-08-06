import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import NewTicketPage from './pages/NewTicketPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import BlacklistPage from './pages/BlacklistPage';
import BackupPage from './pages/BackupPage';
import TicketTypesPage from './pages/TicketTypesPage';
import AutoAssignPage from './pages/AutoAssignPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}

function AdminOrSupervisorRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' || user?.role === 'supervisor'
    ? <>{children}</>
    : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>

        <Route index element={<DashboardPage />} />

        {/* Chamados — todos os papéis */}
        <Route path="chamados"      element={<TicketsPage />} />
        <Route path="chamados/novo" element={<NewTicketPage />} />
        <Route path="chamados/:id"  element={<TicketDetailPage />} />

        {/* Usuários */}
        <Route path="usuarios"   element={<UsersPage />} />

        {/* Relatórios */}
        <Route path="relatorios" element={<ReportsPage />} />

        {/* Tipos de Chamado — todos visualizam; admin/supervisor gerenciam */}
        <Route path="tipos-chamado" element={<TicketTypesPage />} />

		{/* Somente admin */}
        <Route path="blacklist" element={<AdminRoute><BlacklistPage /></AdminRoute>} />
        <Route path="backup"    element={<AdminRoute><BackupPage /></AdminRoute>} />

        {/* Admin e Supervisor */}
        <Route path="atribuicao" element={<AdminOrSupervisorRoute><AutoAssignPage /></AdminOrSupervisorRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
