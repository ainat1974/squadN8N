import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
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
  /** Define o intervalo inicial a partir da ultima coleta, UMA vez,
   *  desde que o usuario ainda nao tenha mexido no filtro. */
  hydrate: (range: DateRange) => void
  /** true depois que o usuario alterou o intervalo manualmente. */
  touched: boolean
  days: number
}

const PeriodContext = createContext<PeriodContextType>({
  range: { dataInicial: '', dataFinal: '' },
  setRange: () => {},
  applyPreset: () => {},
  hydrate: () => {},
  touched: false,
  days: 1,
})

export function PeriodProvider({ children }: { children: ReactNode }) {
  const hoje = todayInSaoPaulo()
  const [range, setRangeState] = useState<DateRange>(() => ({
    dataInicial: hoje,
    dataFinal: hoje,
  }))
  const [touched, setTouched] = useState(false)
  const touchedRef = useRef(false)
  const hydratedRef = useRef(false)

  const setRange = useCallback((next: DateRange) => {
    touchedRef.current = true
    setTouched(true)
    setRangeState(clampRange(next))
  }, [])

  const applyPreset = useCallback((preset: DateRangePreset) => {
    touchedRef.current = true
    setTouched(true)
    setRangeState(clampRange(presetToRange(preset)))
  }, [])

  const hydrate = useCallback((next: DateRange) => {
    if (touchedRef.current || hydratedRef.current) return
    if (!next.dataInicial || !next.dataFinal) return
    hydratedRef.current = true
    setRangeState(clampRange(next))
  }, [])

  const days = useMemo(
    () => daysInRange(range.dataInicial, range.dataFinal),
    [range.dataInicial, range.dataFinal],
  )

  return (
    <PeriodContext.Provider value={{ range, setRange, applyPreset, hydrate, touched, days }}>
      {children}
    </PeriodContext.Provider>
  )
}

export const usePeriod = () => useContext(PeriodContext)
