import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ColetaState = 'idle' | 'starting' | 'polling' | 'success' | 'timeout' | 'error'

type RefreshContextValue = {
  /** Timestamp (ms) da ultima vez que algo pediu refresh global. */
  lastRefresh: number
  /** Sinaliza para todos os hooks useErpData() refazerem fetch. */
  triggerRefresh: () => void
  /** Estado da coleta compartilhado entre todos os botoes Atualizar. */
  coletaState: ColetaState
  setColetaState: (state: ColetaState) => void
}

const RefreshContext = createContext<RefreshContextValue>({
  lastRefresh: 0,
  triggerRefresh: () => {},
  coletaState: 'idle',
  setColetaState: () => {},
})

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [lastRefresh, setLastRefresh] = useState(0)
  const [coletaState, setColetaState] = useState<ColetaState>('idle')
  const triggerRefresh = useCallback(() => setLastRefresh(Date.now()), [])
  return (
    <RefreshContext.Provider value={{ lastRefresh, triggerRefresh, coletaState, setColetaState }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
