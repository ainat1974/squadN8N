// ============================================================
// hooks/useErpData.ts — Hook genérico para buscar dados do ERP
// ============================================================
import { useState, useEffect } from 'react'

interface UseErpDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useErpData<T>(fetcher: () => Promise<T>): UseErpDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

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
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    refresh: () => setTick(t => t + 1)
  }
}
