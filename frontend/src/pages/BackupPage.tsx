import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArchiveBoxIcon, ArrowPathIcon, ServerStackIcon, TrashIcon } from '@heroicons/react/24/outline';
import { backupApi } from '../services/api';
import { LoadingScreen, EmptyState, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';

export default function BackupPage() {
  const [jobs,        setJobs]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [running,     setRunning]     = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { setJobs(await backupApi.list()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRun = async (type: 'full' | 'files') => {
    setRunning(true);
    try {
      const fn = type === 'full' ? backupApi.runFull : backupApi.runFiles;
      const res = await fn();
      toast.success(`Backup concluído! Job #${res.jobId} — ${res.file}`);
      load();
    } catch {
      toast.error('Erro ao executar backup.');
    } finally { setRunning(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Tem certeza que deseja excluir o backup #${id}?\nEsta ação também removerá o arquivo .zip do servidor.`)) return;
    setDeletingId(id);
    try {
      await backupApi.remove(id);
      toast.success(`Backup #${id} excluído com sucesso.`);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      toast.error('Erro ao excluir backup.');
    } finally {
      setDeletingId(null);
    }
  };

  const statusCfg: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Aguardando', cls: 'bg-gray-100 text-gray-600' },
    RUNNING: { label: 'Executando', cls: 'bg-blue-100 text-blue-700' },
    SUCCESS: { label: 'Concluído',  cls: 'bg-green-100 text-green-700' },
    FAILED:  { label: 'Falhou',     cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div>
      <PageHeader
        title="Backup do Sistema"
        subtitle="Histórico de backups e execução manual"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => handleRun('files')} disabled={running}>
              <ServerStackIcon className="w-4 h-4" />
              Backup de Arquivos
            </button>
            <button className="btn-primary" onClick={() => handleRun('full')} disabled={running}>
              <ArchiveBoxIcon className="w-4 h-4" />
              {running ? 'Executando...' : 'Backup Completo'}
            </button>
          </div>
        }
      />

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
        <strong>Backup Automático:</strong> executado diariamente às 02:00h, incluindo arquivos e exportação do banco de dados.
        O backup completo gera um arquivo .zip contendo todos os anexos e os dados das tabelas em formato JSON.
      </div>

      {/* Jobs table */}
      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingScreen /> : jobs.length === 0 ? (
          <EmptyState message="Nenhum backup executado ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Tipo', 'Status', 'Tamanho', 'Iniciado em', 'Finalizado em', 'Obs.', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((j) => {
                const cfg = statusCfg[j.status] || statusCfg.PENDING;
                const isDeleting = deletingId === j.id;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{j.id}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs capitalize">
                      {j.type === 'full' ? 'Completo' : j.type === 'files' ? 'Arquivos' : j.type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', cfg.cls)}>
                        {j.status === 'RUNNING' && (
                          <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {j.file_size ? `${(j.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {j.started_at ? format(new Date(j.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {j.finished_at ? format(new Date(j.finished_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-red-400 text-xs max-w-[200px]">
                      <span className="truncate block" title={j.error_msg}>{j.error_msg || ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(j.id)}
                        disabled={isDeleting || j.status === 'RUNNING'}
                        title="Excluir backup"
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          isDeleting || j.status === 'RUNNING'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        )}
                      >
                        {isDeleting
                          ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          : <TrashIcon className="w-4 h-4" />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
