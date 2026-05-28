import { useCallback, useEffect, useState } from 'react'
import { api, triggerColeta } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { useRefresh } from '../context/RefreshContext'
import { buildApiOptions } from '../utils/period'

export type ColetaState = 'idle' | 'starting' | 'polling' | 'success' | 'timeout' | 'error'

const POLL_INTERVAL_MS = 5000
const POLL_MAX_MS = 240_000

export function useTriggerColeta() {
  const { range } = usePeriod()
  const { triggerRefresh } = useRefresh()
  const [state, setState] = useState<ColetaState>('idle')
  const fetchOptions = buildApiOptions(range)

  useEffect(() => {
    if (state === 'success' || state === 'timeout' || state === 'error') {
      const t = setTimeout(() => setState('idle'), 6000)
      return () => clearTimeout(t)
    }
  }, [state])

  const run = useCallback(
    async (baseAtualizadoEm?: string | null) => {
      setState('starting')
      try {
        await triggerColeta(range.dataInicial, range.dataFinal)
      } catch {
        setState('error')
        return
      }

      setState('polling')
      const start = Date.now()
      while (Date.now() - start < POLL_MAX_MS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        try {
          const fresh = (await api.resumo(fetchOptions)) as Record<string, unknown>
          const novoAt = fresh?.atualizadoEm as string | undefined
          if (novoAt && novoAt !== baseAtualizadoEm) {
            triggerRefresh()
            setState('success')
            return
          }
        } catch {
          // mantem polling
        }
      }
      setState('timeout')
    },
    [range.dataInicial, range.dataFinal, fetchOptions, triggerRefresh],
  )

  const isBusy = state === 'starting' || state === 'polling'

  return { state, run, isBusy }
}
