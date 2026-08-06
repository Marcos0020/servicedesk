import { useEffect, useState } from 'react';
import { CalendarDaysIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { autoAssignApi, usersApi } from '../services/api';
import { PageHeader, ConfirmDialog } from '../components/common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function AutoAssignPage() {
  const [rules, setRules]           = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [confirmId, setConfirmId]   = useState<number | null>(null);

  // Form
  const [responsibleId, setResponsibleId] = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [timeFrom, setTimeFrom]           = useState('08:00');
  const [dateTo, setDateTo]               = useState('');
  const [timeTo, setTimeTo]               = useState('17:00');
  const [saving, setSaving]               = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([autoAssignApi.list(), usersApi.technicians()]);
      setRules(r);
      setTechnicians(t);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!responsibleId || !dateFrom || !dateTo) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    const from = `${dateFrom}T${timeFrom}:00`;
    const to   = `${dateTo}T${timeTo}:00`;
    if (from >= to) { toast.error('A data/hora de início deve ser anterior ao fim.'); return; }
    setSaving(true);
    try {
      await autoAssignApi.create(Number(responsibleId), from, to);
      toast.success('Regra criada com sucesso!');
      setResponsibleId(''); setDateFrom(''); setDateTo('');
      setTimeFrom('08:00'); setTimeTo('17:00');
      await load();
    } catch { toast.error('Erro ao criar regra.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await autoAssignApi.remove(id);
      toast.success('Regra removida.');
      setConfirmId(null);
      await load();
    } catch { toast.error('Erro ao remover regra.'); }
  };

  const fmt = (val: any) => {
    if (!val) return '—';
    try { return format(new Date(val), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
    catch { return val; }
  };

  const isActive = (rule: any) => {
    const now = new Date();
    return rule.is_active === 1 && new Date(rule.date_from) <= now && now <= new Date(rule.date_to);
  };

  return (
    <div>
      <PageHeader
        title="Atribuição Automática"
        subtitle="Chamados abertos no período configurado serão atribuídos automaticamente ao responsável escolhido"
      />

      {/* Form */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <PlusIcon className="w-4 h-4 text-blue-500" />
          Nova Regra
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="form-label">Responsável *</label>
            <select className="form-input" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              <option value="">Selecione...</option>
              {technicians.map((t: any) => (
                <option key={t.ID ?? t.id} value={t.ID ?? t.id}>{t.NAME ?? t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Data início *</label>
            <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Hora início *</label>
            <input type="time" className="form-input" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Data fim *</label>
            <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="form-label">Hora fim *</label>
            <input type="time" className="form-input" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={handleCreate} disabled={saving}>
          <PlusIcon className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Criar Regra'}
        </button>
      </div>

      {/* Rules list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <CalendarDaysIcon className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Regras Cadastradas</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Carregando...</div>
        ) : rules.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Nenhuma regra cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Responsável', 'De', 'Até', 'Status', 'Criado por', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{rule.responsible_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmt(rule.date_from)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmt(rule.date_to)}</td>
                  <td className="px-4 py-3">
                    {isActive(rule) ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                        Ativa agora
                      </span>
                    ) : new Date(rule.date_to) < new Date() ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        Expirada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Agendada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{rule.created_by_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmId(rule.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      title="Remover regra"
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

      <ConfirmDialog
        open={confirmId !== null}
        title="Remover Regra"
        message="Tem certeza que deseja remover esta regra de atribuição automática?"
        confirmLabel="Remover"
        danger
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}