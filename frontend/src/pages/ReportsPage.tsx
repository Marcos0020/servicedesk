import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ChartBarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { reportsApi } from '../services/api';
import { StatusBadge, TypeBadge, LoadingScreen, EmptyState, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FilterForm {
  date_from: string;
  date_to: string;
  status: string;
}

export default function ReportsPage() {
  const [rows,    setRows]    = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, getValues } = useForm<FilterForm>({
    defaultValues: {
      date_from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
      date_to:   format(new Date(), 'yyyy-MM-dd'),
      status:    '',
    },
  });

  const onSearch = async (data: FilterForm) => {
    setLoading(true);
    try {
      const res = await reportsApi.getData({
        date_from: data.date_from,
        date_to:   data.date_to,
        status:    data.status || undefined,
      });
      setRows(res);
    } catch {
      toast.error('Erro ao buscar dados do relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const data = getValues();
    if (!rows || rows.length === 0) {
      toast.error('Gere o relatório antes de exportar.');
      return;
    }
    try {
      toast.loading('Gerando Excel...', { id: 'excel' });
      const token = localStorage.getItem('sd_token');
      const params = new URLSearchParams({
        date_from: data.date_from,
        date_to: data.date_to,
        ...(data.status ? { status: data.status } : {}),
      });
      const response = await fetch(`/api/v1/reports/export/excel?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Erro ao gerar Excel');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_${data.date_from}_${data.date_to}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel baixado com sucesso!', { id: 'excel' });
    } catch {
      toast.error('Erro ao exportar Excel', { id: 'excel' });
    }
  };

  const summary = rows
    ? {
        total:       rows.length,
		abertos:     rows.filter((r) => r.status === 'ABERTO').length,
        andamento:   rows.filter((r) => r.status === 'EM_ANDAMENTO').length,
        finalizados: rows.filter((r) => r.status === 'FINALIZADO').length,
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios de chamados por período"
        actions={
          <button className="btn-primary" onClick={handleExport} disabled={!rows?.length}>
            <ArrowDownTrayIcon className="w-4 h-4" />
            Exportar para Excel
          </button>
        }
      />

      {/* Filter form */}
      <div className="card mb-4">
        <form onSubmit={handleSubmit(onSearch)} className="flex flex-wrap gap-4 items-end" noValidate>
          <div>
            <label className="form-label">Data Início *</label>
            <input type="date" className="form-input" {...register('date_from', { required: true })} />
          </div>
          <div>
            <label className="form-label">Data Fim *</label>
            <input type="date" className="form-input" {...register('date_to', { required: true })} />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" {...register('status')}>
              <option value="">Todos</option>
              <option value="ABERTO">Aberto</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="FINALIZADO">Finalizado</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            <ChartBarIcon className="w-4 h-4" />
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </form>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total',        value: summary.total,       color: 'bg-gray-700' },
            { label: 'Abertos',      value: summary.abertos,     color: 'bg-yellow-500' },
            { label: 'Em Andamento', value: summary.andamento,   color: 'bg-blue-500' },
            { label: 'Finalizados',  value: summary.finalizados, color: 'bg-green-500' },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">{s.value}</span>
              </div>
              <span className="text-sm text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {loading ? (
        <div className="card"><LoadingScreen /></div>
      ) : rows === null ? (
        <div className="card">
          <EmptyState message="Selecione um período e clique em Gerar Relatório." />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState message="Nenhum chamado encontrado no período selecionado." />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#', 'Título', 'Solicitante', 'Tipo', 'Status', 'Responsável', 'Aberto em', 'Finalizado em'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
				   <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{r.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                      <span className="block truncate">{r.title}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px]">
                      <span className="block truncate">{r.requester_name || r.requester_email || '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={r.type} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.responsible_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {r.finalized_at ? format(new Date(r.finalized_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            {rows.length} registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
