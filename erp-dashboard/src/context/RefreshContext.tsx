import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type RefreshContextValue = {
  /** Timestamp (ms) da ultima vez que algo pediu refresh global. */
  lastRefresh: number
  /** Sinaliza para todos os hooks useErpData() refazerem fetch. */
  triggerRefresh: () => void
}

const RefreshContext = createContext<RefreshContextValue>({
  lastRefresh: 0,
  triggerRefresh: () => {},
})

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [lastRefresh, setLastRefresh] = useState(0)
  const triggerRefresh = useCallback(() => setLastRefresh(Date.now()), [])
  return (
    <RefreshContext.Provider value={{ lastRefresh, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
