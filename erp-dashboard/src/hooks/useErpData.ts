// ============================================================
// hooks/useErpData.ts — Hook generico para buscar dados do ERP
//
// Reage automaticamente a refresh global disparado pelo botao
// Atualizar (RefreshContext.triggerRefresh).
// ============================================================
import { useState, useEffect } from 'react'
import { useRefresh } from '../context/RefreshContext'

interface UseErpDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useErpData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseErpDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const { lastRefresh } = useRefresh()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetcher()
      .then(result => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Erro ao carregar dados')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [tick, lastRefresh, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    refresh: () => setTick(t => t + 1)
  }
}
