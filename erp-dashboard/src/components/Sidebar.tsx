import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { preventAutoSilent } from '../lib/biometric'
import { useSidebar } from '../context/SidebarContext'

const navItems = [
  { path: '/visao-geral', code: '01', label: 'Visão Geral' },
  { path: '/insights-financeiro', code: 'IA$', label: 'IA Financeiro' },
  { path: '/insights-estoque', code: 'IA#', label: 'IA Estoque' },
  { path: '/vendas', code: '02', label: 'Vendas' },
  { path: '/estoque', code: '03', label: 'Estoque' },
  { path: '/financeiro', code: '04', label: 'Financeiro' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar()

  // Fecha o drawer mobile ao trocar de rota
  useEffect(() => {
    if (mobileOpen) closeMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Tecla Escape fecha o drawer + trava scroll de fundo enquanto aberto
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
    }
    window.addEventListener('keydown', handler)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileOpen, closeMobile])

  async function handleLogout() {
    await supabase.auth.signOut()
    await preventAutoSilent()
    navigate('/login')
  }

  const widthClass = collapsed ? 'md:w-[72px]' : 'md:w-64'

  return (
    <>
      {/* Backdrop visivel apenas em mobile/tablet quando o drawer esta aberto */}
      <div
        onClick={closeMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/65 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col transition-[width,transform] duration-200 ease-out md:relative md:translate-x-0 ${widthClass} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Cabecalho da sidebar */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-4">
          <div className="brand-mark shrink-0">TM</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-extrabold text-[var(--text-primary)]">Tech Malhas</p>
              <p className="m-0 truncate text-xs text-[var(--text-muted)]">ERP Command Center</p>
            </div>
          )}
          {/* Botao fechar (drawer mobile) */}
          <button
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="ml-auto grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--accent)] md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Botao colapsar (desktop apenas) */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`sidebar-collapse-toggle hidden items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--accent)] md:flex ${
            collapsed ? 'justify-center' : 'justify-end'
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
            aria-hidden="true"
          >
            <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && <span>Recolher</span>}
        </button>

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl border px-2 py-3 text-sm font-bold transition-colors ${
                  isActive
                    ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_rgba(255,122,47,0.18),0_10px_24px_rgba(0,0,0,0.35)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-white/[0.03] text-[10px] font-extrabold">
                {item.code}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-2">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-sm font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--danger)] ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M9 3H3v10h6M11 5l3 3-3 3M7 8h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
