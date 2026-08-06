import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  HomeIcon, TicketIcon, UsersIcon, ChartBarIcon,
  ArchiveBoxIcon, Bars3Icon, XMarkIcon,
  ArrowRightOnRectangleIcon, ShieldExclamationIcon, CalendarDaysIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/',              label: 'Central de Atendimento', icon: HomeIcon,               exact: true, roles: ['admin', 'supervisor', 'technician'] },
  { to: '/chamados',      label: 'Chamados',               icon: TicketIcon,                          roles: ['admin', 'supervisor', 'technician'] },
  { to: '/relatorios',    label: 'Relatórios',             icon: ChartBarIcon,                        roles: ['admin', 'supervisor', 'technician'] },
  { to: '/usuarios',      label: 'Usuários',               icon: UsersIcon,                           roles: ['admin', 'supervisor', 'technician'] },
  { to: '/blacklist',     label: 'Blacklist',              icon: ShieldExclamationIcon,               roles: ['admin'] },
  { to: '/backup',        label: 'Backup',                 icon: ArchiveBoxIcon,                      roles: ['admin'] },
  { to: '/atribuicao',    label: 'Atribuição Automática',  icon: CalendarDaysIcon,                    roles: ['admin', 'supervisor'] },
];

function getRoleLabel(role: string) {
  return { admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico' }[role] ?? role;
}

function getRoleBadgeClass(role: string) {
  return {
    admin:      'bg-purple-500/20 text-purple-200',
    supervisor: 'bg-amber-500/20 text-amber-200',
    technician: 'bg-blue-500/20 text-blue-200',
  }[role] ?? 'bg-blue-500/20 text-blue-200';
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-700 cursor-pointer" onClick={() => window.location.reload()}>
		  <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%)' }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 9h11M7 15h11M7 21h7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="24" cy="22" r="6" fill="#3b82f6"/>
            <path d="M21.5 22l2 2L26.5 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Service Desk</p>
          <p className="text-blue-200 text-xs">Sistema de Chamados</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(user?.role ?? ''))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <span className={clsx(
              'inline-block text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5',
              getRoleBadgeClass(user?.role ?? ''),
            )}>
              {getRoleLabel(user?.role ?? '')}
            </span>
          </div>
          <button onClick={handleLogout} title="Sair" className="text-blue-300 hover:text-white transition-colors">
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-brand-800 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-60 bg-brand-800 flex flex-col z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-brand-800 text-white">
          <button onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="font-semibold text-sm">Service Desk</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
