// ============================================================
// PeriodContext — compartilha período selecionado no Header
// com todas as páginas via React Context
// ============================================================
import { createContext, useContext, useState } from 'react'

export type PeriodKey = '1d' | '7d' | '30d' | '90d' | 'Personalizado'

export const PERIOD_DAYS: Record<PeriodKey, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'Personalizado': 30,
}

interface PeriodContextType {
  period: PeriodKey
  setPeriod: (p: PeriodKey) => void
  days: number
}

const PeriodContext = createContext<PeriodContextType>({
  period: '30d',
  setPeriod: () => {},
  days: 30,
})

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>('30d')
  return (
    <PeriodContext.Provider value={{ period, setPeriod, days: PERIOD_DAYS[period] }}>
      {children}
    </PeriodContext.Provider>
  )
}

export const usePeriod = () => useContext(PeriodContext)
