// ============================================================
// hooks/useIndependentColeta.ts
// Hook GENERICO para paginas com workflow proprio e intervalo
// independente. Cada pagina injeta sua funcao de leitura (snapshot)
// e de disparo (trigger). Mantem: intervalo proprio, teto de 3 meses
// explicito, disparo + polling do snapshot e hidratacao ao ultimo
// intervalo coletado.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampRange,
  daysInRange,
  todayInSaoPaulo,
  MAX_RANGE_DAYS,
  presetToRange,
  type DateRange,
  type DateRangePreset,
} from '../utils/dateRange'

export type ColetaState = 'idle' | 'starting' | 'polling' | 'success' | 'timeout' | 'error'

const POLL_INTERVAL_MS = 5000

type Options = {
  fetchSnapshot: () => Promise<Record<string, unknown>>
  trigger: (dataInicial: string, dataFinal: string) => Promise<void>
  pollMaxMs?: number
}

export function useIndependentColeta({ fetchSnapshot, trigger, pollMaxMs = 180_000 }: Options) {
  const hoje = todayInSaoPaulo()
  const [range, setRangeState] = useState<DateRange>({ dataInicial: hoje, dataFinal: hoje })
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<ColetaState>('idle')
  const [limitMsg, setLimitMsg] = useState<string | null>(null)

  const touchedRef = useRef(false)
  const hydratedRef = useRef(false)
  const [tick, setTick] = useState(0)

  const setRange = useCallback((next: DateRange) => {
    touchedRef.current = true
    if (next.dataInicial && next.dataFinal && daysInRange(next.dataInicial, next.dataFinal) > MAX_RANGE_DAYS) {
      setLimitMsg(`Intervalo limitado a 3 meses (${MAX_RANGE_DAYS} dias). Ajustamos a data inicial.`)
    } else {
      setLimitMsg(null)
    }
    setRangeState(clampRange(next))
  }, [])

  const applyPreset = useCallback((preset: DateRangePreset) => {
    touchedRef.current = true
    setLimitMsg(null)
    setRangeState(clampRange(presetToRange(preset)))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSnapshot()
      .then(json => {
        if (cancelled) return
        setData(json)
        setError(null)
        const ci = json?.dataInicial as string | undefined
        const cf = json?.dataFinal as string | undefined
        if (ci && cf && !touchedRef.current && !hydratedRef.current) {
          hydratedRef.current = true
          setRangeState(clampRange({ dataInicial: ci, dataFinal: cf }))
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Erro ao carregar dados')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick, fetchSnapshot])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (state === 'success' || state === 'timeout' || state === 'error') {
      const t = setTimeout(() => setState('idle'), 6000)
      return () => clearTimeout(t)
    }
  }, [state])

  const baseAtualizadoEm = (data?.atualizadoEm as string | undefined) || null

  const run = useCallback(async () => {
    if (state === 'starting' || state === 'polling') return
    setState('starting')
    try {
      await trigger(range.dataInicial, range.dataFinal)
    } catch {
      setState('error')
      return
    }
    setState('polling')
    const start = Date.now()
    while (Date.now() - start < pollMaxMs) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const fresh = await fetchSnapshot()
        const novoAt = fresh?.atualizadoEm as string | undefined
        if (novoAt && novoAt !== baseAtualizadoEm) {
          setData(fresh)
          setState('success')
          return
        }
      } catch {
        // mantem polling
      }
    }
    setState('timeout')
  }, [state, range.dataInicial, range.dataFinal, baseAtualizadoEm, fetchSnapshot, trigger, pollMaxMs])

  const isBusy = state === 'starting' || state === 'polling'

  const collectedIni = data?.dataInicial as string | undefined
  const collectedFim = data?.dataFinal as string | undefined
  const intervaloPendente = Boolean(
    touchedRef.current &&
      collectedIni &&
      collectedFim &&
      `${range.dataInicial}|${range.dataFinal}` !== `${collectedIni}|${collectedFim}`,
  )

  return { range, setRange, applyPreset, data, loading, error, state, isBusy, run, refresh, limitMsg, intervaloPendente }
}
