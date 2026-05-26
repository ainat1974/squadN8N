import { NavLink, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/visao-geral', icon: '📊', label: 'Visão Geral' },
  { path: '/vendas',      icon: '📈', label: 'Vendas' },
  { path: '/estoque',     icon: '📦', label: 'Estoque' },
  { path: '/financeiro',  icon: '💰', label: 'Financeiro' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  function handleLogout() {
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('user_info')
    navigate('/login')
  }

  return (
    <aside className="w-56 bg-[#1e293b] flex flex-col border-r border-[#475569] shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#475569]">
        <span className="text-[#38bdf8] font-bold text-sm">⚡ Tech Malhas</span>
        <p className="text-[#64748b] text-xs mt-0.5">Dashboard ERP</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#334155] text-[#38bdf8]'
                  : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9]'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-4 border-t border-[#475569]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#94a3b8] hover:bg-[#334155] hover:text-[#ef4444] transition-colors"
        >
          <span>👤</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
