import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clampRange,
  presetToRange,
  todayInSaoPaulo,
  daysInRange,
  type DateRange,
  type DateRangePreset,
} from '../utils/dateRange'

export type { DateRange, DateRangePreset }

interface PeriodContextType {
  range: DateRange
  setRange: (range: DateRange) => void
  applyPreset: (preset: DateRangePreset) => void
  days: number
}

const PeriodContext = createContext<PeriodContextType>({
  range: { dataInicial: '', dataFinal: '' },
  setRange: () => {},
  applyPreset: () => {},
  days: 1,
})

export function PeriodProvider({ children }: { children: ReactNode }) {
  const hoje = todayInSaoPaulo()
  const [range, setRangeState] = useState<DateRange>(() => ({
    dataInicial: hoje,
    dataFinal: hoje,
  }))

  const setRange = useCallback((next: DateRange) => {
    setRangeState(clampRange(next))
  }, [])

  const applyPreset = useCallback((preset: DateRangePreset) => {
    setRangeState(clampRange(presetToRange(preset)))
  }, [])

  const days = useMemo(
    () => daysInRange(range.dataInicial, range.dataFinal),
    [range.dataInicial, range.dataFinal],
  )

  return (
    <PeriodContext.Provider value={{ range, setRange, applyPreset, days }}>
      {children}
    </PeriodContext.Provider>
  )
}

export const usePeriod = () => useContext(PeriodContext)
