// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex flex-col w-full max-h-[90vh] ${sizes[size]} bg-brand-card border border-brand-border rounded-2xl shadow-modal animate-slide-in`}>
        {title && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-brand-border shrink-0">
            <h2 className="font-display text-lg font-semibold text-brand-white">{title}</h2>
            <button onClick={onClose} className="text-brand-muted hover:text-brand-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── Badge ──────────────────────────────────────────────────────────────────
const BADGE_COLORS = {
  LIVRE:      'bg-green-900/40 text-green-400 border-green-800',
  OCUPADA:    'bg-brand-red/20 text-red-400 border-brand-red/40',
  CONTA:      'bg-purple-900/40 text-purple-300 border-purple-700',
  RESERVADA:  'bg-blue-900/40 text-blue-400 border-blue-800',
  LIMPEZA:    'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  ABERTO:     'bg-green-900/40 text-green-400 border-green-800',
  PREPARANDO: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  PRONTO:     'bg-blue-900/40 text-blue-400 border-blue-800',
  FECHAMENTO: 'bg-purple-900/40 text-purple-300 border-purple-700',
  FINALIZADO: 'bg-gray-800 text-gray-400 border-gray-700',
  CANCELADO:  'bg-red-950 text-red-500 border-red-900',
  PENDENTE:   'bg-orange-900/40 text-orange-400 border-orange-800',
  ENTREGUE:   'bg-purple-900/40 text-purple-400 border-purple-800',
  AGUARDANDO: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  CHAMADO:    'bg-blue-900/40 text-blue-400 border-blue-800',
  SENTADO:    'bg-green-900/40 text-green-400 border-green-800',
  ADM_MAXIMO: 'bg-brand-gold/20 text-brand-gold border-brand-gold/40',
  GERENTE:    'bg-purple-900/40 text-purple-400 border-purple-800',
  GARCOM:     'bg-blue-900/40 text-blue-400 border-blue-800',
  COZINHA:    'bg-orange-900/40 text-orange-400 border-orange-800',
  PARRILLA:   'bg-red-900/40 text-red-400 border-red-800',
  CAIXA:      'bg-green-900/40 text-green-400 border-green-800',
  RECEPCAO:   'bg-indigo-900/40 text-indigo-400 border-indigo-800',
}

export function StatusBadge({ status, label }) {
  const color = BADGE_COLORS[status] || 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`badge border ${color}`}>{label || status}</span>
  )
}

// ─── LoadingSpinner ──────────────────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} border-2 border-brand-border border-t-brand-gold rounded-full animate-spin`} />
    </div>
  )
}

// ─── EmptyState ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={48} className="text-brand-border mb-4" />}
      <h3 className="text-brand-white font-medium text-lg mb-1">{title}</h3>
      {description && <p className="text-brand-muted text-sm mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── StatCard ────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`card p-5 ${accent ? 'border-brand-gold/30 shadow-gold-lg' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-brand-muted text-sm">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-brand-gold/15' : 'bg-brand-border'}`}>
          <Icon size={18} className={accent ? 'text-brand-gold' : 'text-brand-muted'} />
        </div>
      </div>
      <div className={`text-2xl font-bold font-display ${accent ? 'text-brand-gold' : 'text-brand-white'}`}>{value}</div>
      {sub && <div className="text-xs text-brand-muted mt-1">{sub}</div>}
    </div>
  )
}

// ─── PageHeader ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-brand-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ─── FormField ───────────────────────────────────────────────────────────────
export function FormField({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-brand-muted text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>Confirmar</button>
      </div>
    </Modal>
  )
}
