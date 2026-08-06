import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ticketsApi, usersApi } from '../services/api';
import { StatusBadge, LoadingScreen, EmptyState, PageHeader } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';

const PAGE_SIZE = 20;

function CategoryBadge({ category, subcategory }: { category?: string; subcategory?: string }) {
  if (!category) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
        {category}
      </span>
      {subcategory && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
          {subcategory}
        </span>
      )}
    </div>
  );
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tickets,      setTickets]      = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [technicians,  setTechnicians]  = useState<any[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string[]>>({});

  // Filters
  const [search,       setSearch]       = useState('');
  const [status,       setStatus]       = useState('');
  const [category,     setCategory]     = useState('');
  const [subcategory,  setSubcategory]  = useState('');
  const [responsibleId,setResponsibleId]= useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [timeFrom,     setTimeFrom]     = useState('');
  const [timeTo,       setTimeTo]       = useState('');

  useEffect(() => {
    usersApi.technicians().then(setTechnicians).catch(() => {});
    fetch('/api/v1/tickets/categories', {
      headers: { Authorization: `Bearer ${localStorage.getItem('sd_token')}` },
    })
      .then((r) => r.json())
      .then((data: { category: string; subcategories: string[] }[]) => {
        const map: Record<string, string[]> = {};
        data.forEach((d) => { map[d.category] = d.subcategories; });
        setCategoriesMap(map);
      })
      .catch(() => {});
  }, []);

  const buildDatetime = (date: string, time: string, endOfDay = false) => {
    if (!date) return undefined;
    const t = time || (endOfDay ? '23:59:59' : '00:00:00');
    return `${date}T${t}`;
  };

	const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ticketsApi.list({
        search:         search       || undefined,
        status:         status       || undefined,
        category:       category     || undefined,
        subcategory:    subcategory  || undefined,
        responsible_id: responsibleId ? Number(responsibleId) : undefined,
        date_from:      buildDatetime(dateFrom, timeFrom, false),
        date_to:        buildDatetime(dateTo,   timeTo,   true),
        page,
        limit: PAGE_SIZE,
      });
      setTickets(res.data || []);
      setTotal(res.total  || 0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, status, category, subcategory, responsibleId, dateFrom, dateTo, timeFrom, timeTo, page]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => fetchTickets(true), 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const handleFilter = () => { setPage(1); };

  const handleClear = () => {
    setSearch(''); setStatus(''); setCategory(''); setSubcategory('');
    setResponsibleId(''); setDateFrom(''); setDateTo('');
    setTimeFrom(''); setTimeTo(''); setPage(1);
  };

  const subcategoryOptions = category ? categoriesMap[category] || [] : [];
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = !!(search || status || category || subcategory || responsibleId || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Chamados"
        subtitle={`${total} chamado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        actions={
          <button className="btn-primary" onClick={() => navigate('/chamados/novo')}>
            <PlusIcon className="w-4 h-4" />
            Novo Chamado
          </button>
        }
      />

      {/* Filter panel */}
      <div className="card mb-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="form-label">Buscar</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Título, solicitante ou e-mail..."
                  className="form-input pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="ABERTO">Aberto</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="FINALIZADO">Finalizado</option>
              </select>
            </div>

            <div>
              <label className="form-label">Categoria</label>
              <select className="form-input" value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
                <option value="">Todas</option>
                {Object.keys(categoriesMap).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Subcategoria</label>
              <select className="form-input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}
                disabled={!category}>
                <option value="">Todas</option>
                {subcategoryOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Responsável</label>
              <select className="form-input" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
                <option value="">Todos</option>
                {technicians.map((t: any) => (
                  <option key={t.ID} value={t.ID}>{t.NAME}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end border-t border-gray-100 pt-3">
            <div className="text-xs font-medium text-gray-500 self-center pr-1">Período:</div>

            <div>
              <label className="form-label">Data início</label>
              <input type="date" className="form-input" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Hora início</label>
              <input type="time" step="1" className="form-input w-32" value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)} />
            </div>

            <div className="text-gray-400 self-end pb-2">→</div>

            <div>
              <label className="form-label">Data fim</label>
              <input type="date" className="form-input" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Hora fim</label>
              <input type="time" step="1" className="form-input w-32" value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)} />
            </div>

            <div className="flex gap-2 ml-auto">
              <button className="btn-primary" onClick={handleFilter}>
                <FunnelIcon className="w-4 h-4" />
                Filtrar
              </button>
              {hasActiveFilters && (
                <button className="btn-secondary" onClick={handleClear}>
                  <XMarkIcon className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingScreen />
        ) : tickets.length === 0 ? (
          <EmptyState message="Nenhum chamado encontrado com os filtros selecionados." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['#', 'Título', 'Solicitante', 'Categoria', 'Status', 'Responsável', 'Enviado em', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.map((t) => (
                    <tr
                      key={t.ID}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/chamados/${t.ID}`)}
                    >
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">#{t.ID}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                        <span className="block truncate" title={t.TITLE}>{t.TITLE}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px]">
                        <span className="block truncate text-xs" title={t.REQUESTER_EMAIL}>
                          {t.REQUESTER_NAME || t.REQUESTER_EMAIL || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <CategoryBadge category={t.CATEGORY} subcategory={t.SUBCATEGORY} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={t.STATUS} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {t.RESPONSIBLE_NAME || <span className="text-gray-300">Não atribuído</span>}
                      </td>
					  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {(t.EMAIL_SENT_AT || t.CREATED_AT)
                          ? format(new Date(t.EMAIL_SENT_AT ?? t.CREATED_AT), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-brand-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                          Ver →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .map((p, idx, arr) => (
                      <span key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-2 py-1 text-gray-400 text-xs">…</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={clsx(
                            'px-3 py-1 rounded text-xs font-medium transition-colors',
                            p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-200',
                          )}
                        >{p}</button>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}