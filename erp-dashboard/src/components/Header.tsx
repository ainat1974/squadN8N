import { useState } from 'react'
import { api, formatDate } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import type { PeriodKey } from '../context/PeriodContext'
import { useErpData } from '../hooks/useErpData'
import { periodDays, periodLabel } from '../utils/period'
import { StatusPill } from './DashboardPrimitives'

const periods: PeriodKey[] = ['1d', '7d', '30d', '90d']

export default function Header() {
  const { period, setPeriod } = usePeriod()
  const [refreshing, setRefreshing] = useState(false)
  const dias = periodDays(period)
  const resumo = useErpData(() => api.resumo({ periodo: period, dias }), [period])
  const meta = resumo.data as any

  async function handleRefresh() {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    if (!webhookUrl) return

    setRefreshing(true)
    try {
      await fetch(webhookUrl, { method: 'POST' })
      resumo.refresh()
    } catch {
      // O N8N registra a falha; a UI conserva o ultimo snapshot valido.
    } finally {
      setTimeout(() => setRefreshing(false), 2000)
    }
  }

  return (
    <header className="topbar flex shrink-0 items-center gap-3 px-4 md:px-6">
      <div className="hidden min-w-0 md:block">
        <p className="m-0 text-xs font-bold text-[var(--text-secondary)]">Base operacional</p>
        <p className="m-0 truncate text-xs text-[var(--text-muted)]">
          {meta?.data ? `Coleta ${meta.janelaColeta || 'D-1'}: ${formatDate(meta.data)}` : 'Aguardando dados do N8N'}
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <div className="flex rounded-xl border border-[var(--border)] bg-black/30 p-1">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`period-button px-3 text-xs font-bold ${period === p ? 'active' : ''}`}
              title={`Ver ${periodLabel(p)}`}
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>

        {meta?.periodo && (
          <StatusPill tone="orange">
            {meta.periodo.inicio || meta.data} a {meta.periodo.fim || meta.data}
          </StatusPill>
        )}

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="action-button px-3 text-xs font-bold disabled:opacity-60"
        >
          {refreshing ? 'Atualizando' : 'Atualizar'}
        </button>
      </div>
    </header>
  )
}
