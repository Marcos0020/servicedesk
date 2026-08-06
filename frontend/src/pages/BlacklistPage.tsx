import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { emailApi } from '../services/api';
import { LoadingScreen, EmptyState, Modal, ConfirmDialog, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function BlacklistPage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [delOpen,  setDelOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const load = async () => {
    setLoading(true);
    try { setItems(await emailApi.blacklist()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: any) => {
    setSaving(true);
    try {
      await emailApi.addBlacklist(data.email, data.reason || '');
      toast.success('E-mail adicionado à blacklist!');
      setModal(false);
      reset();
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar e-mail');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await emailApi.removeBlacklist(selected.id);
      toast.success('E-mail removido da blacklist.');
      setDelOpen(false);
      load();
    } catch {
      toast.error('Erro ao remover e-mail');
    }
  };

  const handleFetchNow = async () => {
    try {
      const res = await emailApi.fetchNow();
      toast.success(`E-mails processados: ${res.processed} | Ignorados: ${res.skipped}`);
    } catch {
      toast.error('Erro ao buscar e-mails');
    }
  };

  return (
    <div>
      <PageHeader
        title="Blacklist de E-mails"
        subtitle="Remetentes bloqueados não geram chamados automaticamente"
        actions={
          <button className="btn-primary" onClick={() => { reset(); setModal(true); }}>
            <PlusIcon className="w-4 h-4" />
            Bloquear E-mail
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingScreen /> : items.length === 0 ? (
          <EmptyState message="Nenhum e-mail bloqueado. Adicione e-mails para ignorá-los automaticamente." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['E-mail', 'Motivo', 'Bloqueado por', 'Data', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
				<tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldExclamationIcon className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="font-medium text-gray-900 text-xs">{item.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.reason || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.created_by_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setSelected(item); setDelOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover da blacklist"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Bloquear E-mail" size="sm">
        <form onSubmit={handleSubmit(handleAdd)} className="space-y-4" noValidate>
          <div>
            <label className="form-label">E-mail *</label>
            <input
              type="email"
              className="form-input"
              placeholder="spam@exemplo.com"
              {...register('email', { required: 'E-mail é obrigatório' })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
          </div>
          <div>
            <label className="form-label">Motivo</label>
            <input className="form-input" placeholder="Ex: spam, remetente inválido" {...register('reason')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn-danger">
              {saving ? 'Bloqueando...' : 'Bloquear E-mail'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={delOpen}
        title="Remover da Blacklist"
        message={`Deseja permitir e-mails de "${selected?.email}" novamente?`}
        confirmLabel="Remover bloqueio"
        onConfirm={handleDelete}
        onCancel={() => setDelOpen(false)}
      />
    </div>
  );
}
