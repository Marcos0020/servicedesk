import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, PencilSquareIcon, PaperClipIcon,
  TrashIcon, ArrowDownTrayIcon, ClockIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';
import { ticketsApi, usersApi, attachmentsApi } from '../services/api';
import {
  StatusBadge, LoadingScreen, Modal, ConfirmDialog, PageHeader,
} from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm, Controller } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';
import CategoryPicker, {
  loadCategories,
  saveCategories,
  loadSubcategories,
  saveSubcategories,
} from '../components/CategoryPicker';

export default function TicketDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const isAdmin      = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const isTechnician = user?.role === 'technician';

  // Supervisor agora tem as mesmas permissões de edição e exclusão do admin
  const canDelete = isAdmin || isSupervisor;

  const [ticket,      setTicket]      = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editOpen,    setEditOpen]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [selfAssigning, setSelfAssigning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, setValue, control } = useForm();
  const watchCategory = watch('category', 'SUPORTE');

  // opções de categoria/subcategoria (localStorage)
  const [categories, setCategories]     = useState<string[]>(loadCategories);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  const loadTicket = async () => {
    try {
      const [t, techs] = await Promise.all([
        ticketsApi.get(Number(id)),
        usersApi.technicians(),
      ]);
      setTicket(t);
      setTechnicians(techs);
      reset({
        title:           t.TITLE,
        description:     t.DESCRIPTION,
        requester_name:  t.REQUESTER_NAME,
        requester_email: t.REQUESTER_EMAIL,
        category:        t.CATEGORY    || 'SUPORTE',
        subcategory:     t.SUBCATEGORY || 'OUTRO',
        status:          t.STATUS,
        responsible_id: t.RESPONSIBLE_ID ?? null,
      });
    } catch {
      toast.error('Chamado não encontrado.');
      navigate('/chamados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTicket(); }, [id]);

  // sincroniza subcategorias quando categoria muda no formulário de edição
  useEffect(() => {
    if (watchCategory) {
      const subs = loadSubcategories(watchCategory);
      setSubcategories(subs);
    }
  }, [watchCategory]);

	const handleSave = async (data: any) => {
	  setSaving(true);
	  try {
		const payload: any = {
		  title:           data.title,
		  description:     data.description,
		  requester_name:  data.requester_name,
		  requester_email: data.requester_email,
		  category:        data.category,
		  subcategory:     data.subcategory,
		  status:          data.status,
		};

		
		const current = ticket.RESPONSIBLE_ID != null ? Number(ticket.RESPONSIBLE_ID) : null;
		const incoming =
		  data.responsible_id === '' || data.responsible_id === null
			? null
			: Number(data.responsible_id);

		if (current !== incoming) {
		  payload.responsible_id = incoming;
		}

		if (isTechnician) {
		  delete payload.responsible_id;
		}

		await ticketsApi.update(Number(id), payload);
		toast.success('Chamado atualizado com sucesso!');
		setEditOpen(false);
		loadTicket();
	  } catch (err: any) {
		toast.error(err.response?.data?.message || 'Erro ao atualizar chamado');
	  } finally {
		setSaving(false);
	  }
	};

  /** Técnico atribui o chamado para si mesmo */
  const handleSelfAssign = async () => {
    setSelfAssigning(true);
    try {
      await ticketsApi.update(Number(id), { responsible_id: Number(user?.id) });
      toast.success('Chamado atribuído a você!');
      loadTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao se auto-atribuir');
    } finally {
      setSelfAssigning(false);
    }
  };

  const handleQuickStatus = async (status: string) => {
    try {
      await ticketsApi.update(Number(id), { status });
      toast.success(`Status alterado para: ${translateStatus(status)}`);
      loadTicket();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    try {
      await ticketsApi.remove(Number(id));
      toast.success('Chamado excluído.');
      navigate('/chamados');
    } catch {
      toast.error('Erro ao excluir chamado');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await attachmentsApi.upload(Number(id), file);
      toast.success('Arquivo anexado com sucesso!');
      loadTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    try {
      await attachmentsApi.remove(attId);
      toast.success('Anexo removido.');
      loadTicket();
    } catch {
      toast.error('Erro ao remover anexo');
    }
  };

  const handleDownloadAttachment = async (attId: number, fileName: string) => {
    try {
      const blob = await attachmentsApi.download(attId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar anexo');
    }
  };

  if (loading) return <LoadingScreen />;
  if (!ticket) return null;

  const statusOptions    = ['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO'];
  const isAlreadyAssigned = Number(ticket.RESPONSIBLE_ID) === Number(user?.id);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Chamado #${ticket.ID}`}
        subtitle={ticket.TITLE}
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => navigate('/chamados')}>
              <ArrowLeftIcon className="w-4 h-4" />
              Voltar
            </button>
            <button className="btn-primary" onClick={() => setEditOpen(true)}>
              <PencilSquareIcon className="w-4 h-4" />
              Editar
            </button>
            {canDelete && (
              <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Details card */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Detalhes do Chamado</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Título</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">{ticket.TITLE}</dd>
              </div>
              {ticket.DESCRIPTION && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Descrição</dt>
                  <dd className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">
                    {ticket.DESCRIPTION}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Attachments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Anexos ({ticket.attachments?.length || 0})
              </h2>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.xlsx,.xls,.docx,.doc"
                  onChange={handleFileUpload}
                />
                <button
                  className="btn-secondary text-xs"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <PaperClipIcon className="w-3.5 h-3.5" />
                  {uploading ? 'Enviando...' : 'Anexar Arquivo'}
                </button>
              </div>
            </div>
            {!ticket.attachments?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum anexo.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {ticket.attachments.map((att: any) => (
                  <li key={att.ID} className="flex items-center justify-between py-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{att.ORIGINAL_NAME}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        ({Math.round(att.FILE_SIZE / 1024)} KB)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDownloadAttachment(att.ID, att.ORIGINAL_NAME)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"
                        title="Baixar"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(att.ID)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Audit log — visível para todos */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Histórico de Alterações
            </h2>
            {!ticket.logs?.length ? (
              <p className="text-sm text-gray-400 text-center py-2">Nenhuma alteração registrada.</p>
            ) : (
              <ul className="space-y-2">
                {ticket.logs.map((log: any, i: number) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <span className="text-gray-300 shrink-0 mt-0.5">•</span>
                    <div>
                      <span className="font-medium text-gray-700">{translateAction(log.ACTION)}</span>
                      {log.OLD_VALUE && log.NEW_VALUE && (
                        <span className="text-gray-400"> — {log.OLD_VALUE} → {log.NEW_VALUE}</span>
                      )}
                      {log.NEW_VALUE && !log.OLD_VALUE && (
                        <span className="text-gray-400"> — {log.NEW_VALUE}</span>
                      )}
                      <div className="text-gray-400 mt-0.5">
                        {log.PERFORMED_BY && <span>{log.PERFORMED_BY} · </span>}
                        {log.CREATED_AT && format(new Date(log.CREATED_AT), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Status</h2>
            <div className="mb-3"><StatusBadge status={ticket.STATUS} /></div>
            <div className="flex flex-col gap-2">
              {statusOptions.filter((s) => s !== ticket.STATUS).map((s) => (
                <button
                  key={s}
                  onClick={() => handleQuickStatus(s)}
                  className="btn-secondary text-xs justify-center"
                >
                  → {translateStatus(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-atribuição para técnico */}
          {isTechnician && !isAlreadyAssigned && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Atribuição</h2>
              <p className="text-xs text-gray-500 mb-3">
                Este chamado{ticket.RESPONSIBLE_NAME
                  ? ` está atribuído a ${ticket.RESPONSIBLE_NAME}`
                  : ' não está atribuído'}.
              </p>
              <button
                onClick={handleSelfAssign}
                disabled={selfAssigning}
                className="btn-primary text-xs w-full justify-center"
              >
                <UserCircleIcon className="w-4 h-4" />
                {selfAssigning ? 'Atribuindo...' : 'Atribuir para mim'}
              </button>
            </div>
          )}

          {isTechnician && isAlreadyAssigned && (
            <div className="card">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <UserCircleIcon className="w-4 h-4" />
                <span className="font-medium">Atribuído a você</span>
              </div>
            </div>
          )}

          {/* Info card — todos os papéis veem todas as informações */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Informações</h2>
            <Row label="Categoria"   value={ticket.CATEGORY    || '—'} />
            <Row label="Subcategoria" value={ticket.SUBCATEGORY || '—'} />
            <Row label="Origem"      value={ticket.SOURCE === 'EMAIL' ? '📧 E-mail' : '🖱️ Manual'} />
            <Row label="Solicitante" value={ticket.REQUESTER_NAME  || '—'} />
            <Row label="E-mail"      value={ticket.REQUESTER_EMAIL || '—'} />
            <Row label="Responsável" value={ticket.RESPONSIBLE_NAME || 'Não atribuído'} />
            <Row label="Enviado em"  value={(ticket.EMAIL_SENT_AT || ticket.CREATED_AT) ? format(new Date(ticket.EMAIL_SENT_AT ?? ticket.CREATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'} />
			<Row label="Aberto em"   value={ticket.CREATED_AT ? format(new Date(ticket.CREATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'} />
            {ticket.FINALIZED_AT && (
              <Row label="Finalizado em" value={format(new Date(ticket.FINALIZED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR })} />
            )}
          </div>
        </div>
      </div>

      {/* Edit modal — mesmo formulário completo para todos os papéis */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Chamado" size="lg">
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
          <div>
            <label className="form-label">Título *</label>
            <input className="form-input" {...register('title', { required: true })} />
          </div>
          <div>
            <label className="form-label">Descrição / Resolução</label>
            <textarea rows={4} className="form-input resize-none" {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nome do Solicitante</label>
              <input className="form-input" {...register('requester_name')} />
            </div>
            <div>
              <label className="form-label">E-mail do Solicitante</label>
              <input type="email" className="form-input" {...register('requester_email')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Controller name="category" control={control}
                render={({ field }) => (
                  <CategoryPicker kind="category" label="Categoria"
                    options={categories} value={field.value || 'SUPORTE'}
                    onChange={(v) => { field.onChange(v); setValue('subcategory', loadSubcategories(v)[0] ?? 'OUTRO'); }}
                    onOptionsChange={(upd) => { saveCategories(upd); setCategories(upd); }} />
                )}
              />
            </div>
            <div>
              <Controller name="subcategory" control={control}
                render={({ field }) => (
                  <CategoryPicker kind="subcategory" label="Subcategoria"
                    options={subcategories.length ? subcategories : loadSubcategories(watchCategory)}
                    value={field.value || 'OUTRO'}
                    onChange={field.onChange}
                    onOptionsChange={(upd) => { saveSubcategories(watchCategory, upd); setSubcategories(upd); }} />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" {...register('status')}>
                <option value="ABERTO">Aberto</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="FINALIZADO">Finalizado</option>
              </select>
            </div>
            <div>
              <label className="form-label">Responsável (Técnico)</label>
              <select className="form-input"{...register('responsible_id')}defaultValue={ticket.RESPONSIBLE_ID ?? ''}>
                <option value="">Não atribuído</option>
                {technicians.map((u: any) => (
                  <option key={u.ID} value={u.ID}>{u.NAME}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir Chamado"
        message={`Tem certeza que deseja excluir o chamado #${ticket.ID}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-700 mt-0.5">{value}</dd>
    </div>
  );
}

function translateStatus(s: string) {
  return { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', FINALIZADO: 'Finalizado' }[s] || s;
}

function translateAction(a: string) {
  const map: Record<string, string> = {
    created:                 'Chamado criado',
    created_from_email:      'Chamado criado via e-mail',
    status_changed:          'Status alterado',
    assigned:                'Responsável alterado',
    title_changed:           'Título alterado',
    description_changed:     'Descrição alterada',
    category_changed:        'Categoria alterada',
    subcategory_changed:     'Subcategoria alterada',
    requester_name_changed:  'Nome do solicitante alterado',
    requester_email_changed: 'E-mail do solicitante alterado',
    deleted:                 'Chamado excluído',
  };
  return map[a] || a;
}
