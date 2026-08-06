import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  PlusIcon, PencilSquareIcon, TrashIcon,
  MagnifyingGlassIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { usersApi } from '../services/api';
import { LoadingScreen, EmptyState, Modal, ConfirmDialog, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';

export default function UsersPage() {
  const { user } = useAuthStore();
  const isAdmin      = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canManage    = isAdmin || isSupervisor;   // pode criar, editar e excluir
  // Técnico apenas visualiza

  const [users,    setUsers]    = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [delOpen,  setDelOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await usersApi.list();
      setUsers(list);
      setFiltered(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  // Client-side search filter
  useEffect(() => {
    if (!search.trim()) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter((u) =>
      u.NAME?.toLowerCase().includes(q) ||
      u.EMAIL?.toLowerCase().includes(q) ||
      u.ROLE?.toLowerCase().includes(q),
    ));
  }, [search, users]);

  const openCreate = () => {
    reset({ role: 'technician', is_active: true });
    setModal('create');
  };

  const openEdit = (u: any) => {
    setSelected(u);
    reset({ name: u.NAME, email: u.EMAIL, role: u.ROLE, is_active: u.IS_ACTIVE === 1, password: '' });
    setModal('edit');
  };

  const openView = (u: any) => {
    setSelected(u);
    setModal('view');
  };

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      if (modal === 'create') {
        const { is_active: _ignored, ...payload } = data;
        await usersApi.create(payload);
        toast.success('Usuário criado com sucesso!');
      } else {
        const payload = { ...data };
        if (!payload.password) delete payload.password;
        await usersApi.update(selected.ID, payload);
        toast.success('Usuário atualizado!');
      }
      setModal(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar usuário');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await usersApi.remove(selected.ID);
      toast.success('Usuário desativado.');
      setDelOpen(false);
      loadUsers();
    } catch { toast.error('Erro ao desativar usuário'); }
  };

  const roleLabel = (r: string) =>
    ({ admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico' }[r] ?? r);

  const roleBadge = (r: string) => clsx(
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    r === 'admin'      ? 'bg-purple-100 text-purple-800' :
    r === 'supervisor' ? 'bg-amber-100  text-amber-800'  :
                         'bg-blue-100   text-blue-800',
  );

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle={canManage
          ? 'Gerencie administradores, supervisores e técnicos do sistema'
          : 'Visualize os usuários do sistema'}
        actions={
          isAdmin ? (
            <button className="btn-primary" onClick={openCreate}>
              <PlusIcon className="w-4 h-4" />
              Novo Usuário
            </button>
          ) : null
        }
      />

      {/* Search bar */}
      <div className="card mb-4">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou papel..."
            className="form-input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearch('')}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingScreen /> : filtered.length === 0 ? (
          <EmptyState message="Nenhum usuário encontrado." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Usuário', 'E-mail', 'Papel', 'Status', 'Criado em', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <tr key={u.ID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
                        {u.NAME?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.NAME}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.EMAIL}</td>
                  <td className="px-4 py-3">
                    <span className={roleBadge(u.ROLE)}>{roleLabel(u.ROLE)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      u.IS_ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    )}>
                      {u.IS_ACTIVE ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.CREATED_AT ? format(new Date(u.CREATED_AT), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Lupa — visível para todos */}
                      <button
                        onClick={() => openView(u)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"
                        title="Visualizar detalhes"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      </button>

                      {/* Editar — admin e supervisor */}
                      {canManage && (
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"
                          title="Editar"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                      )}

                      {/* Excluir — somente admin */}
                      {isAdmin && (
                        <button
                          onClick={() => { setSelected(u); setDelOpen(true); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Desativar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View modal — todos os papéis podem abrir */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title="Detalhes do Usuário">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-2xl font-bold">
                {selected.NAME?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{selected.NAME}</p>
                <span className={roleBadge(selected.ROLE)}>{roleLabel(selected.ROLE)}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
              {[
                { label: 'E-mail',    value: selected.EMAIL },
                { label: 'Status',    value: selected.IS_ACTIVE ? 'Ativo' : 'Inativo' },
                { label: 'Criado em', value: selected.CREATED_AT ? format(new Date(selected.CREATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—' },
                { label: 'Atualizado', value: selected.UPDATED_AT ? format(new Date(selected.UPDATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end gap-2 pt-2">
              {canManage && (
                <button className="btn-primary" onClick={() => openEdit(selected)}>
                  <PencilSquareIcon className="w-4 h-4" />
                  Editar
                </button>
              )}
              <button className="btn-secondary" onClick={() => setModal(null)}>Fechar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit modal — apenas admin e supervisor */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
      >
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
          <div>
            <label className="form-label">Nome Completo *</label>
            <input className="form-input" {...register('name', { required: 'Nome é obrigatório' })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{String(errors.name.message)}</p>}
          </div>
          <div>
            <label className="form-label">E-mail *</label>
            <input type="email" className="form-input"
              {...register('email', { required: 'E-mail é obrigatório' })} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{String(errors.email.message)}</p>}
          </div>
          <div>
            <label className="form-label">
              {modal === 'create' ? 'Senha *' : 'Nova Senha (deixe em branco para manter)'}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Mínimo 8 caracteres"
              {...register('password', {
                required: modal === 'create' ? 'Senha é obrigatória' : false,
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
              })}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{String(errors.password.message)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Papel</label>
              <select className="form-input" {...register('role')}>
                <option value="technician">Técnico</option>
                <option value="supervisor">Supervisor</option>
                {isAdmin && <option value="admin">Administrador</option>}
              </select>
            </div>
            {modal === 'edit' && (
              <div>
                <label className="form-label">Status</label>
                <select className="form-input"
                  {...register('is_active', { setValueAs: (v) => v === 'true' || v === true })}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : modal === 'create' ? 'Criar Usuário' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={delOpen}
        title="Desativar Usuário"
        message={`Deseja desativar o usuário "${selected?.NAME}"? Ele perderá acesso ao sistema.`}
        confirmLabel="Desativar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDelOpen(false)}
      />
    </div>
  );
}
