import { useEffect, useState } from 'react'
import { api, formatDate } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import type { PeriodKey } from '../context/PeriodContext'
import { useErpData } from '../hooks/useErpData'
import { useRefresh } from '../context/RefreshContext'
import { periodDays, periodLabel } from '../utils/period'
import { StatusPill } from './DashboardPrimitives'

const periods: PeriodKey[] = ['1d']

type RefreshState = 'idle' | 'starting' | 'polling' | 'success' | 'timeout' | 'error'

const POLL_INTERVAL_MS = 5000
const POLL_MAX_MS = 150_000 // 2,5 min — pipeline atual leva ~75s

function formatTime(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function describeColeta(meta: any): { label: string; tone: 'green' | 'orange' | 'red' | 'muted' } {
  const cron = meta?.ultimaColetaCron as string | null
  const manual = meta?.ultimaColetaManual as string | null
  const fonte = meta?.fonteUltimaColeta as string | null

  if (cron && isToday(cron)) {
    return { label: `Cron 06h OK ${formatTime(cron)}`, tone: 'green' }
  }
  if (manual && isToday(manual)) {
    if (fonte === 'webhook') {
      return { label: `Atualizado ${formatTime(manual)}`, tone: 'orange' }
    }
    return { label: `Atualizado ${formatTime(manual)} (manual)`, tone: 'orange' }
  }
  // Nada coletado hoje — ver se cron passou e falhou ou ainda nao chegou
  const now = new Date()
  const isAfter6 = now.getHours() >= 6
  if (isAfter6) {
    return { label: 'Sem coleta hoje', tone: 'red' }
  }
  return { label: 'Aguardando cron 06h', tone: 'muted' }
}

export default function Header() {
  const { period, setPeriod } = usePeriod()
  const { triggerRefresh } = useRefresh()
  const [refreshState, setRefreshState] = useState<RefreshState>('idle')
  const dias = periodDays(period)
  const resumo = useErpData(() => api.resumo({ periodo: period, dias }), [period])
  const meta = resumo.data as any

  const coleta = describeColeta(meta)

  // Limpa pill de status apos 6s no estado terminal
  useEffect(() => {
    if (refreshState === 'success' || refreshState === 'timeout' || refreshState === 'error') {
      const t = setTimeout(() => setRefreshState('idle'), 6000)
      return () => clearTimeout(t)
    }
  }, [refreshState])

  async function handleRefresh() {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    if (!webhookUrl) {
      setRefreshState('error')
      return
    }
    const baseAtualizadoEm = meta?.atualizadoEm as string | undefined
    const baseManual = meta?.ultimaColetaManual as string | undefined

    setRefreshState('starting')
    try {
      const resp = await fetch(webhookUrl, { method: 'POST' })
      if (!resp.ok) {
        setRefreshState('error')
        return
      }
    } catch {
      setRefreshState('error')
      return
    }

    setRefreshState('polling')
    const start = Date.now()

    while (Date.now() - start < POLL_MAX_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const fresh = await api.resumo({ periodo: period, dias })
        const novoAt = (fresh as any)?.atualizadoEm
        const novoManual = (fresh as any)?.ultimaColetaManual
        const mudou =
          (novoAt && novoAt !== baseAtualizadoEm) ||
          (novoManual && novoManual !== baseManual)
        if (mudou) {
          // Backend ja gravou nova coleta — propaga refresh global
          triggerRefresh()
          setRefreshState('success')
          return
        }
      } catch {
        // mantem polling
      }
    }
    setRefreshState('timeout')
  }

  const isBusy = refreshState === 'starting' || refreshState === 'polling'

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

        <StatusPill tone={coleta.tone}>{coleta.label}</StatusPill>

        {refreshState === 'starting' && <StatusPill tone="blue">Iniciando coleta…</StatusPill>}
        {refreshState === 'polling' && <StatusPill tone="blue">Coletando ERP…</StatusPill>}
        {refreshState === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {refreshState === 'timeout' && <StatusPill tone="red">Tempo esgotado</StatusPill>}
        {refreshState === 'error' && <StatusPill tone="red">Falha no webhook</StatusPill>}

        <button
          onClick={handleRefresh}
          disabled={isBusy}
          className="action-button px-3 text-xs font-bold disabled:opacity-60"
          title="Forca o n8n a coletar dados frescos do ERP agora"
        >
          {isBusy ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </header>
  )
}
