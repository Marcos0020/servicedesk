/**
 * CategoryPicker — lupa no label + modal estilo "Pesquisa" com busca e add inline
 *
 * Layout do modal:
 *  ┌─────────────────────────────────────────┐
 *  │ PESQUISA {CATEGORIA|SUBCATEGORIA}    [X] │
 *  ├──────────────────────────────────┬───┬──┤
 *  │  🔍 campo de busca               │ 🔍│ +│  ← linha de busca + botão add (só admin/sup)
 *  ├──────────────────────────────────┴───┴──┤
 *  │  [formulário de add — expande ao clicar +] │
 *  ├─────────────────────────────────────────┤
 *  │  DESCRIÇÃO                          ↑ ⋮ │  ← cabeçalho da tabela
 *  ├─────────────────────────────────────────┤
 *  │  ≡  SUPORTE                             │
 *  │  ≡  FINANCEIRO                          │
 *  │  …                                      │
 *  ├─────────────────────────────────────────┤
 *  │  [paginação]            CANCELAR    OK  │
 *  └─────────────────────────────────────────┘
 */

import { useState, useMemo } from 'react';
import {
  MagnifyingGlassIcon, PlusIcon, TrashIcon, XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

// ── tipos ────────────────────────────────────────────────────────────────────
export type CategoryKind = 'category' | 'subcategory';

interface CategoryPickerProps {
  kind: CategoryKind;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onOptionsChange?: (newOptions: string[]) => void;
}

// ── persistência localStorage ─────────────────────────────────────────────────
const STORAGE_KEY_CATEGORIES = 'sd_categories';
const storageKeySubs = (cat: string) => `sd_subcategories_${cat}`;

export const DEFAULT_CATEGORIES: Record<string, string[]> = {
  SUPORTE:        ['HARDWARE', 'SOFTWARE', 'REDE', 'ACESSO', 'IMPRESSORA', 'OUTRO'],
  FINANCEIRO:     ['FATURAMENTO', 'PAGAMENTO', 'REEMBOLSO', 'OUTRO'],
  COMERCIAL:      ['PROPOSTA', 'CONTRATO', 'PARCERIA', 'OUTRO'],
  INFRAESTRUTURA: ['SERVIDOR', 'BANCO_DE_DADOS', 'BACKUP', 'OUTRO'],
  RH:             ['ADMISSAO', 'DEMISSAO', 'FERIAS', 'OUTRO'],
};

export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return Object.keys(DEFAULT_CATEGORIES);
}
export function saveCategories(cats: string[]) {
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
}
export function loadSubcategories(cat: string): string[] {
  try {
    const raw = localStorage.getItem(storageKeySubs(cat));
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return DEFAULT_CATEGORIES[cat] ?? ['OUTRO'];
}
export function saveSubcategories(cat: string, subs: string[]) {
  localStorage.setItem(storageKeySubs(cat), JSON.stringify(subs));
}

// ── paginação ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

// ── componente ────────────────────────────────────────────────────────────────
export default function CategoryPicker({
  kind,
  label,
  options,
  value,
  onChange,
  disabled = false,
  onOptionsChange,
}: CategoryPickerProps) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'supervisor';
  const kindLabel = kind === 'category' ? 'Categoria' : 'Subcategoria';

  const [modalOpen, setModalOpen]   = useState(false);
  const [search,    setSearch]      = useState('');
  const [addOpen,   setAddOpen]     = useState(false);   // painel de cadastro expandido
  const [newValue,  setNewValue]    = useState('');
  const [page,      setPage]        = useState(1);
  const [selected,  setSelected]    = useState(value);   // seleção interna antes de confirmar

  // filtra e pagina
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openModal = () => {
    setSelected(value);
    setSearch('');
    setPage(1);
    setAddOpen(false);
    setNewValue('');
    setModalOpen(true);
  };

  const handleOk = () => {
    onChange(selected);
    setModalOpen(false);
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleAdd = () => {
    const trimmed = newValue.trim().toUpperCase().replace(/\s+/g, '_');
    if (!trimmed) { toast.error('Digite uma descrição.'); return; }
    if (options.includes(trimmed)) { toast.error('Já existe.'); return; }
    const updated = [...options, trimmed];
    onOptionsChange?.(updated);
    setNewValue('');
    setAddOpen(false);
    toast.success(`${kindLabel} "${trimmed}" adicionada!`);
  };

  const handleRemove = (opt: string) => {
    if (options.length <= 1) { toast.error('Deve existir pelo menos uma opção.'); return; }
    const updated = options.filter((o) => o !== opt);
    if (selected === opt) setSelected(updated[0]);
    if (value   === opt) onChange(updated[0]);
    onOptionsChange?.(updated);
    toast.success(`${kindLabel} "${opt}" removida.`);
  };

  return (
    <>
      {/* ── campo select + lupa no label ─────────────────────────────────── */}
      <div>
        {/* Label com lupa embutida no canto direito */}
        <div className="flex items-center justify-between mb-1">
          <span className="form-label mb-0">{label}</span>
          <button
            type="button"
            title={`Pesquisar / Gerenciar ${kindLabel}`}
            onClick={openModal}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors focus:outline-none"
          >
            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Select normal sem lupa dentro */}
        <select
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
          />

          {/* Painel */}
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg z-10 flex flex-col overflow-hidden"
               style={{ maxHeight: '90vh' }}>

            {/* ── Cabeçalho ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Pesquisa {kindLabel}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* ── Barra de pesquisa + botão + ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="form-input pl-8 text-sm"
                  autoFocus
                />
              </div>

              {/* Botão + (só admin/supervisor) */}
              {canManage && (
                <button
                  type="button"
                  title="Adicionar novo"
                  onClick={() => { setAddOpen((v) => !v); setNewValue(''); }}
                  className={`w-9 h-9 flex items-center justify-center rounded text-white text-lg font-bold transition-colors shrink-0 ${addOpen ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* ── Painel de cadastro (expansível) ── */}
            {addOpen && canManage && (
              <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  {kindLabel.toUpperCase()}
                </p>
                <div className="mb-1">
                  <label className="text-xs text-gray-500 mb-1 block">DESCRIÇÃO</label>
                  <input
                    type="text"
                    placeholder={`Ex: NOVA_${kindLabel.toUpperCase()}`}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                    className="form-input text-sm"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Espaços → sublinhado · texto será convertido para maiúsculas
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setAddOpen(false)}
                    className="btn-secondary text-xs px-3 py-1.5">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleAdd}
                    className="btn-primary text-xs px-3 py-1.5">
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* ── Cabeçalho da tabela ── */}
            <div className="flex items-center px-4 py-2 border-b border-gray-200 bg-gray-50">
              <span className="w-7 shrink-0" />
              <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Descrição
              </span>
              {canManage && <span className="w-6 shrink-0" />}
            </div>

            {/* ── Lista / tabela ── */}
            <div className="overflow-y-auto flex-1">
              {pageItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum registro encontrado.</p>
              ) : (
                pageItems.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => setSelected(opt)}
                    className={`flex items-center px-4 py-2.5 cursor-pointer border-b border-gray-100 group transition-colors
                      ${selected === opt ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* ícone de drag (decorativo, igual ao sistema ref) */}
                    <Bars3Icon className="w-4 h-4 text-gray-300 shrink-0 mr-3" />

                    <span className={`flex-1 text-sm ${selected === opt ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                      {opt}
                    </span>

                    {canManage && (
                      <button
                        type="button"
                        title="Excluir"
                        onClick={(e) => { e.stopPropagation(); handleRemove(opt); }}
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ── Rodapé: paginação + botões ── */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              {/* Paginação */}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <button
                  type="button" disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  title="Primeira">
                  «
                </button>
                <button
                  type="button" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  title="Anterior">
                  ‹
                </button>

                {/* páginas numéricas */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-gray-300">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-6 h-6 flex items-center justify-center rounded border text-xs
                          ${p === page
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'border-gray-300 hover:bg-gray-100 text-gray-600'}`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}

                <button
                  type="button" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  title="Próxima">
                  ›
                </button>
                <button
                  type="button" disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  title="Última">
                  »
                </button>

                <span className="ml-2 text-gray-400">
                  Exibindo {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} {filtered.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {/* Cancelar / OK */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleOk}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                >
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
