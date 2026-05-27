import { NavLink, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/visao-geral', code: '01', label: 'Visao Geral' },
  { path: '/vendas', code: '02', label: 'Vendas' },
  { path: '/estoque', code: '03', label: 'Estoque' },
  { path: '/financeiro', code: '04', label: 'Financeiro' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  function handleLogout() {
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('user_info')
    navigate('/login')
  }

  return (
    <>
      <aside className="sidebar-shell hidden w-64 shrink-0 flex-col md:flex">
        <div className="border-b border-[var(--border)] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="brand-mark">TM</div>
            <div>
              <p className="m-0 text-sm font-extrabold text-[var(--text-primary)]">Tech Malhas</p>
              <p className="m-0 text-xs text-[var(--text-muted)]">ERP Command Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                  isActive
                    ? 'border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_0_0_1px_rgba(255,122,47,0.18),0_10px_24px_rgba(0,0,0,0.35)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border)] bg-white/[0.03] text-[10px]">
                {item.code}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-transparent px-3 py-3 text-left text-sm font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--danger)]"
          >
            Sair
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 gap-1 rounded-lg border border-[var(--border)] bg-black/90 p-1 shadow-2xl backdrop-blur md:hidden">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `rounded-md px-2 py-2 text-center text-[11px] font-bold ${
                isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`
            }
          >
            {item.code}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
