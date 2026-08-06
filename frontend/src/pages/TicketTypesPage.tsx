import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon, PlusIcon, TrashIcon,
  XMarkIcon, ArrowPathIcon, TagIcon,
} from '@heroicons/react/24/outline';
import { ticketTypesApi } from '../services/api';
import { PageHeader, LoadingScreen, EmptyState } from '../components/common';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Search/Manage Modal ────────────────────────────────────────────────────
function TicketTypesModal({
  open,
  onClose,
  onSelect,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  onSelect?: (type: any) => void;
  canManage: boolean;
}) {
  const [types,       setTypes]       = useState<any[]>([]);
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async (q = search) => {
    setLoading(true);
    try { setTypes(await ticketTypesApi.list(q)); }
    catch { toast.error('Erro ao carregar tipos.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) {
      setSearch('');
      setShowAdd(false);
      load('');
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error('Informe o nome do tipo.'); return; }
    setSaving(true);
    try {
      await ticketTypesApi.create(newName.trim(), newDesc.trim() || undefined);
      toast.success('Tipo criado com sucesso!');
      setNewName('');
      setNewDesc('');
      setShowAdd(false);
      load('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar tipo.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Excluir o tipo "${name}"?`)) return;
    setDeletingId(id);
    try {
      await ticketTypesApi.remove(id);
      toast.success('Tipo excluído.');
      setTypes((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error('Erro ao excluir tipo.');
    } finally { setDeletingId(null); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Pesquisa Tipo de Chamado
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar + add button */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="form-input flex-1 text-sm"
            />
            <button
              type="submit"
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
              title="Pesquisar"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="p-2 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors"
                title="Adicionar novo tipo"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Inline add form */}
          {canManage && showAdd && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Novo Tipo</p>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Nome do tipo *"
                className="form-input text-sm w-full"
                maxLength={200}
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="form-input text-sm w-full"
                maxLength={500}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setNewName(''); setNewDesc(''); }}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {saving ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : types.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              Nenhum registro encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                    ≡
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  {canManage && <th className="w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {types.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-blue-50 transition-colors group"
                    onClick={() => onSelect && onSelect(t)}
                    style={{ cursor: onSelect ? 'pointer' : 'default' }}
                  >
                    <td className="px-5 py-2.5">
                      <span className="text-gray-300 text-base">≡</span>
                    </td>
                    <td className="px-2 py-2.5 text-gray-800 font-medium">
                      {t.name}
                      {t.description && (
                        <p className="text-xs text-gray-400 font-normal">{t.description}</p>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(t.id, t.name)}
                          disabled={deletingId === t.id}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Excluir"
                        >
                          {deletingId === t.id
                            ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                            : <TrashIcon className="w-3.5 h-3.5" />
                          }
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          <span>Exibindo {types.length} {types.length === 1 ? 'item' : 'itens'}</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded border border-red-400 bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
            >
              Cancelar
            </button>
            {onSelect && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded border border-blue-800 bg-blue-900 text-white text-xs font-medium hover:bg-blue-800 transition-colors"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function TicketTypesPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  const [types,    setTypes]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTypes(await ticketTypesApi.list()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Reload after modal closes in case user added/deleted
  const handleModalClose = () => {
    setModalOpen(false);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Tipos de Chamado"
        subtitle="Gerencie os tipos disponíveis para os chamados"
        actions={
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <MagnifyingGlassIcon className="w-4 h-4" />
            {canManage ? 'Gerenciar Tipos' : 'Visualizar Tipos'}
          </button>
        }
      />

      {/* Summary table — read-only view for all roles */}
      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingScreen /> : types.length === 0 ? (
          <EmptyState message="Nenhum tipo de chamado cadastrado." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Nome', 'Descrição', 'Criado em', ...(canManage ? ['Ações'] : [])].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {types.map((t) => (
                <TypeRow
                  key={t.id}
                  type={t}
                  canManage={canManage}
                  onDeleted={() => setTypes((prev) => prev.filter((x) => x.id !== t.id))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TicketTypesModal
        open={modalOpen}
        onClose={handleModalClose}
        canManage={canManage}
      />
    </div>
  );
}

function TypeRow({ type: t, canManage, onDeleted }: { type: any; canManage: boolean; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Excluir o tipo "${t.name}"?`)) return;
    setDeleting(true);
    try {
      await ticketTypesApi.remove(t.id);
      toast.success('Tipo excluído.');
      onDeleted();
    } catch {
      toast.error('Erro ao excluir tipo.');
    } finally { setDeleting(false); }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{t.id}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="font-medium text-gray-800">{t.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">{t.description || '—'}</td>
      <td className="px-4 py-3 text-gray-400 text-xs">
        {t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
      </td>
      {canManage && (
        <td className="px-4 py-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Excluir"
          >
            {deleting
              ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
              : <TrashIcon className="w-4 h-4" />
            }
          </button>
        </td>
      )}
    </tr>
  );
}
