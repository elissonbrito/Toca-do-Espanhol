import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, ChefHat, Flame,
  Ticket, Banknote, Users, ScrollText, LogOut, Menu, X, ChevronRight,
  BookOpen, ShieldCheck, Printer, BarChart3
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

const NAV_ITEMS = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard',  exact: true, roles: ['ADM_MAXIMO'] },
  { to: '/tables',  icon: UtensilsCrossed, label: 'Mesas' },
  { to: '/orders',  icon: ClipboardList,   label: 'Pedidos' },
  { to: '/menu',    icon: BookOpen,        label: 'Cardápio' },
  { to: '/fiscal',  icon: ShieldCheck,     label: 'Conferência Fiscal', roles: ['ADM_MAXIMO','GERENTE'] },
  { to: '/kitchen', icon: ChefHat,         label: 'Cozinha',    roles: ['COZINHA','ADM_MAXIMO','GERENTE'] },
  { to: '/parrilla',icon: Flame,           label: 'Parrilla',   roles: ['PARRILLA','ADM_MAXIMO','GERENTE'] },
  { to: '/queue',   icon: Ticket,          label: 'Fila' },
  { to: '/cash',    icon: Banknote,        label: 'Caixa',      roles: ['CAIXA','ADM_MAXIMO','GERENTE'] },
  { to: '/print-station', icon: Printer,   label: 'Impressão',  roles: ['ADM_MAXIMO','GERENTE','CAIXA','COZINHA','PARRILLA'] },
  { to: '/reports', icon: BarChart3,       label: 'Relatórios', roles: ['ADM_MAXIMO','GERENTE'] },
  { to: '/printers',icon: Printer,         label: 'Impressoras', roles: ['ADM_MAXIMO','GERENTE'] },
  { to: '/users',   icon: Users,           label: 'Usuários',   roles: ['ADM_MAXIMO','GERENTE'] },
  { to: '/audit',   icon: ScrollText,      label: 'Auditoria',  roles: ['ADM_MAXIMO','GERENTE'] },
]

const ROLE_LABELS = {
  ADM_MAXIMO: 'Administrador',
  GERENTE: 'Gerente',
  GARCOM: 'Garçom',
  COZINHA: 'Cozinha',
  PARRILLA: 'Parrilla',
  CAIXA: 'Caixa',
  RECEPCAO: 'Recepção',
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.info('Sessão encerrada.')
    navigate('/login')
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || hasRole(...item.roles)
  )

  const SidebarContent = ({ expanded }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center shadow-gold">
            <Flame size={18} className="text-brand-gold" />
          </div>
          {expanded && (
            <div className="animate-fade-in">
              <p className="font-display font-bold text-brand-white text-sm leading-tight">Toca do</p>
              <p className="font-display font-bold text-brand-gold text-sm leading-tight">Espanhol</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
              ${isActive
                ? 'bg-brand-red text-white shadow-gold'
                : 'text-brand-muted hover:text-brand-white hover:bg-brand-border'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {expanded && (
              <span className="font-medium text-sm animate-fade-in">{label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-brand-border">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-dark ${expanded ? '' : 'justify-center'}`}>
          <div className="w-8 h-8 rounded-full bg-brand-gold-muted flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-brand-gold">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          {expanded && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-medium text-brand-white truncate">{user?.name}</p>
              <p className="text-xs text-brand-gold truncate">{ROLE_LABELS[user?.role]}</p>
            </div>
          )}
          {expanded && (
            <button onClick={handleLogout} className="text-brand-muted hover:text-brand-red transition-colors" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
        {!expanded && (
          <button onClick={handleLogout} className="w-full mt-2 flex justify-center text-brand-muted hover:text-brand-red transition-colors py-1" title="Sair">
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-brand-black overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-brand-dark border-r border-brand-border transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'}`}>
        <SidebarContent expanded={sidebarOpen} />
      </aside>

      {/* Mobile Sidebar — sempre expandido (mostra os nomes ao abrir) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-brand-dark border-r border-brand-border flex flex-col">
            <SidebarContent expanded />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-brand-dark border-b border-brand-border flex items-center gap-4 px-4">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden text-brand-muted hover:text-brand-white transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="hidden md:block text-brand-muted hover:text-brand-white transition-colors"
            aria-label="Recolher menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-brand-muted">
            <span className="hidden sm:inline">{user?.name}</span>
            <span className="text-brand-gold text-xs px-2 py-0.5 bg-brand-gold/10 rounded border border-brand-gold/30">
              {ROLE_LABELS[user?.role]}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
