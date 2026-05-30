// ============================================================
// hooks/useApplyRangeFromUrl.ts
// CK-OV-1 — quando uma pagina e aberta com query string
// ?dataInicial=YYYY-MM-DD&dataFinal=YYYY-MM-DD (ex.: vinda da
// Visao Geral via botao "Ver detalhe"), aplica o intervalo no
// PeriodContext e LIMPA a URL para nao reaplicar em refresh.
// Funciona apenas para paginas legadas (Vendas/Estoque/Financeiro).
// ============================================================
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePeriod } from '../context/PeriodContext'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function useApplyRangeFromUrl() {
  const [params, setParams] = useSearchParams()
  const { setRange } = usePeriod()
  const appliedRef = useRef(false)

  useEffect(() => {
    if (appliedRef.current) return
    const di = params.get('dataInicial')
    const df = params.get('dataFinal')
    if (di && df && ISO.test(di) && ISO.test(df)) {
      appliedRef.current = true
      setRange({ dataInicial: di, dataFinal: df })
      const next = new URLSearchParams(params)
      next.delete('dataInicial')
      next.delete('dataFinal')
      setParams(next, { replace: true })
    }
  }, [params, setParams, setRange])
}
