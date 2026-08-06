/**
 * TicketTypePicker — lupa reutilizável para selecionar tipo de chamado
 *
 * Uso no formulário:
 *   <TicketTypePicker
 *     value={selectedType}
 *     onChange={(type) => setValue('category', type.name)}
 *     readOnly={isTechnician}
 *   />
 */
import { useEffect, useState, useRef } from 'react';
import {
  MagnifyingGlassIcon, XMarkIcon,
  PlusIcon, TrashIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { ticketTypesApi } from '../services/api';

interface TicketTypePicker {
  value?: string;
  onChange?: (typeName: string) => void;
  readOnly?: boolean;
  canManage?: boolean; // admin or supervisor: can add/delete inside modal
}

export function TicketTypePicker({
  value = '',
  onChange,
  readOnly = false,
  canManage = false,
}: TicketTypePicker) {
  const [open,        setOpen]        = useState(false);
  const [types,       setTypes]       = useState<any[]>([]);
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTypes = async (q = '') => {
    setLoading(true);
    try { setTypes(await ticketTypesApi.list(q)); }
    catch { toast.error('Erro ao carregar tipos.'); }
    finally { setLoading(false); }
  };

  const openModal = () => {
    if (readOnly) return;
    setSearch('');
    setShowAdd(false);
    setOpen(true);
    loadTypes('');
    setTimeout(() => searchRef.current?.focus(), 120);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTypes(search);
  };

  const handleSelect = (t: any) => {
    onChange?.(t.name);
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error('Informe o nome.'); return; }
    setSaving(true);
    try {
      const created = await ticketTypesApi.create(newName.trim());
      toast.success('Tipo criado!');
      onChange?.(created.name);
      setOpen(false);
      setNewName('');
      setShowAdd(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar tipo.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir "${name}"?`)) return;
    setDeletingId(id);
    try {
      await ticketTypesApi.remove(id);
      toast.success('Tipo excluído.');
      setTypes((prev) => prev.filter((t) => t.id !== id));
      if (value === name) onChange?.('');
    } catch { toast.error('Erro ao excluir.'); }
    finally { setDeletingId(null); }
  };

  return (
    <>
      {/* Input field with search icon */}
      <div className="relative flex items-center">
        <input
          type="text"
          readOnly
          value={value}
          placeholder="Selecione um tipo..."
          className={`form-input pr-10 ${readOnly ? 'bg-gray-50 cursor-default' : 'cursor-pointer'}`}
          onClick={openModal}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={openModal}
            className="absolute right-2 p-1 text-gray-400 hover:text-brand-600 transition-colors"
            title="Pesquisar tipo"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                Pesquisa Tipo de Chamado
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Search + add */}
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
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAdd((v) => !v)}
                    className="p-2 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-600"
                    title="Adicionar"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                )}
              </form>

              {canManage && showAdd && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Novo Tipo</p>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Nome *"
                    className="form-input text-sm w-full"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }} className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
                    <button type="button" onClick={handleAdd} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
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
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider w-8">≡</th>
                      <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                      {canManage && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {types.map((t) => (
                      <tr key={t.id} className="hover:bg-blue-50 cursor-pointer group" onClick={() => handleSelect(t)}>
                        <td className="px-5 py-2.5 text-gray-300 text-base">≡</td>
                        <td className="px-2 py-2.5 text-gray-800 font-medium">{t.name}</td>
                        {canManage && (
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => handleDelete(e, t.id, t.name)}
                              disabled={deletingId === t.id}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
                <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded border border-red-400 bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded border border-blue-800 bg-blue-900 text-white text-xs font-medium hover:bg-blue-800 transition-colors">
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
