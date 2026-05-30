import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type SidebarContextValue = {
  /** Estado desktop: true = ocupa 72px (so icones); false = ocupa 256px. */
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (v: boolean) => void
  /** Estado mobile/tablet: true = drawer aberto sobre o conteudo. */
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = 'erp:sidebar-collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const setCollapsed = useCallback((v: boolean) => setCollapsedState(v), [])
  const toggleCollapsed = useCallback(() => setCollapsedState(prev => !prev), [])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const toggleMobile = useCallback(() => setMobileOpen(prev => !prev), [])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleCollapsed,
        setCollapsed,
        mobileOpen,
        openMobile,
        closeMobile,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar deve ser usado dentro de SidebarProvider')
  return ctx
}
