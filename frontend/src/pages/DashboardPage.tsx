import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TicketIcon, ClockIcon, CheckCircleIcon,
  ExclamationCircleIcon, PlusIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { ticketsApi, emailApi } from '../services/api';
import { StatCard, StatusBadge, TypeBadge, LoadingScreen, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTechnician = user?.role === 'technician';
  const canCreate    = true; // todos os papéis podem criar chamados

  const [summary, setSummary] = useState<any>(null);
  const [recent,  setRecent]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTotal, setLastTotal] = useState<number | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const recentPromise = isTechnician
      ? ticketsApi.list({ responsible_id: user?.id, limit: 8, page: 1 }).then((r) => r.data || [])
      : ticketsApi.recent(8);
    const [sum, rec] = await Promise.all([ticketsApi.summary(), recentPromise]);
    setSummary(sum);
    setRecent(rec);
    setLastTotal(Number(sum?.TOTAL || 0));
    if (!silent) setLoading(false);
  }, [isTechnician, user?.id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const [fetchingEmail, setFetchingEmail] = useState(false);

  const handleFetchNow = async () => {
    setFetchingEmail(true);
    try {
      const res = await emailApi.fetchNow();
      toast.success(`E-mails processados: ${res.processed} | Ignorados: ${res.skipped}`);
      fetchData(true);
    } catch {
      toast.error('Erro ao buscar e-mails');
    } finally {
      setFetchingEmail(false);
    }
  };

  if (loading) return <LoadingScreen />;

  // Para técnico: os stats mostram apenas os chamados dele
  const stats = [
    { label: 'Total de Chamados',  value: Number(summary?.TOTAL || 0),        color: 'bg-brand-600',  icon: TicketIcon           },
    { label: 'Abertos',            value: Number(summary?.ABERTOS || 0),       color: 'bg-yellow-500', icon: ExclamationCircleIcon },
    { label: 'Em Andamento',       value: Number(summary?.EM_ANDAMENTO || 0),  color: 'bg-blue-500',   icon: ClockIcon            },
    { label: 'Finalizados',        value: Number(summary?.FINALIZADOS || 0),   color: 'bg-green-500',  icon: CheckCircleIcon      },
  ];

  return (
    <div>
      <PageHeader
        title="Central de Atendimento"
        subtitle={isTechnician ? 'Seus chamados atribuídos' : 'Visão geral do sistema de chamados'}
        actions={
          <div className="flex gap-2">
            {!isTechnician && (
              <button
                className="btn-secondary"
                onClick={handleFetchNow}
                disabled={fetchingEmail}
              >
                <EnvelopeIcon className="w-4 h-4" />
                {fetchingEmail ? 'Buscando...' : 'Buscar E-mails'}
              </button>
            )}
            {canCreate && (
              <button className="btn-primary" onClick={() => navigate('/chamados/novo')}>
                <PlusIcon className="w-4 h-4" />
                Novo Chamado
              </button>
            )}
          </div>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Recent tickets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Chamados Recentes</h2>
          <button
            onClick={() => navigate('/chamados')}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Ver todos →
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Nenhum chamado encontrado.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider w-16">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Responsável</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Aberto em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((t) => (
                  <tr
                    key={t.ID}
                    onClick={() => navigate(`/chamados/${t.ID}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 text-gray-400 font-mono text-xs">#{t.ID}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 max-w-xs truncate">{t.TITLE}</td>
                    <td className="px-3 py-3 hidden sm:table-cell"><TypeBadge type={t.TYPE} /></td>
                    <td className="px-3 py-3"><StatusBadge status={t.STATUS} /></td>
                    <td className="px-3 py-3 text-gray-500 hidden md:table-cell">{t.RESPONSIBLE_NAME || '—'}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {t.CREATED_AT ? format(new Date(t.CREATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
