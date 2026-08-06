import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';

// ── Status Badge ─────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ABERTO:       { label: 'Aberto',       cls: 'badge-aberto' },
    EM_ANDAMENTO: { label: 'Em Andamento', cls: 'badge-em_andamento' },
    FINALIZADO:   { label: 'Finalizado',   cls: 'badge-finalizado' },
  };
  const cfg = map[status] || { label: status, cls: 'badge-comum' };
  return <span className={cfg.cls}>{cfg.label}</span>;
}

// ── Type Badge ───────────────────────────────────────────────
export function TypeBadge({ type }: { type: string }) {
  return type === 'COMPLEXO'
    ? <span className="badge-complexo">Complexo</span>
    : <span className="badge-comum">Comum</span>;
}

// ── Spinner ──────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-slate-200 border-t-blue-500', className)} />
  );
}

// ── Loading screen ───────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Spinner className="w-8 h-8" />
      <p className="text-xs text-slate-400 font-medium tracking-wide">Carregando...</p>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
        <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 150ms ease' }}
      />
      <div
        className={clsx('relative bg-white rounded-2xl shadow-2xl w-full z-10 overflow-hidden', widths[size])}
        style={{
          animation: 'slideUp 200ms cubic-bezier(0.16,1,0.3,1)',
          border: '1px solid rgba(226,232,240,0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)' }}>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  icon: React.ElementType;
}
export function StatCard({ label, value, color, icon: Icon }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 group transition-all duration-200 hover:-translate-y-0.5">
      <div className={clsx(
        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
        color,
      )}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tabular-nums">{value ?? '—'}</p>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Page header ──────────────────────────────────────────────
export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-0.5 font-medium">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Confirmation dialog ──────────────────────────────────────
interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}
export function ConfirmDialog({
  open, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger = false,
}: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
