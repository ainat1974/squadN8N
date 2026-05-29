import { useEffect, useRef } from 'react'
import { api, formatDate } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { useErpData } from '../hooks/useErpData'
import { useTriggerColeta } from '../hooks/useTriggerColeta'
import { buildApiOptions } from '../utils/period'
import { formatRangeLabel } from '../utils/dateRange'
import { StatusPill } from './DashboardPrimitives'

const AUTO_COLETA_DEBOUNCE_MS = 1500

function formatTime(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function describeUltimaConsulta(meta: Record<string, unknown> | null | undefined) {
  const inicio = meta?.dataInicial as string | undefined
  const fim = meta?.dataFinal as string | undefined
  const atualizado = meta?.atualizadoEm as string | undefined
  const periodo = meta?.periodo as { inicio?: string; fim?: string } | undefined

  const pi = inicio || periodo?.inicio
  const pf = fim || periodo?.fim

  if (pi && pf) {
    const hora = atualizado ? ` · ${formatTime(atualizado)}` : ''
    return {
      label: `Última consulta: ${formatRangeLabel(pi, pf)}${hora}`,
      tone: 'orange' as const,
    }
  }
  if (meta?.data) {
    return { label: `Base ${formatDate(String(meta.data))}`, tone: 'muted' as const }
  }
  return { label: 'Nenhuma coleta ainda', tone: 'muted' as const }
}

export default function Header() {
  const { range, hydrate, touched } = usePeriod()
  const { state, run, isBusy } = useTriggerColeta()
  const fetchOptions = buildApiOptions(range)
  const resumo = useErpData(() => api.resumo(fetchOptions), [range.dataInicial, range.dataFinal])
  const meta = resumo.data as Record<string, unknown> | null
  const consulta = describeUltimaConsulta(meta)

  const collectedIni = meta?.dataInicial as string | undefined
  const collectedFim = meta?.dataFinal as string | undefined
  const atualizadoEm = meta?.atualizadoEm as string | undefined

  // Ao abrir, alinha o filtro ao ultimo intervalo coletado (uma unica vez).
  useEffect(() => {
    if (collectedIni && collectedFim) hydrate({ dataInicial: collectedIni, dataFinal: collectedFim })
  }, [collectedIni, collectedFim, hydrate])

  // Auto-coleta: quando o usuario muda o intervalo e ele difere do coletado,
  // dispara a coleta automaticamente (com debounce e trava anti-duplicidade).
  const runRef = useRef(run)
  runRef.current = run
  const selectedKey = `${range.dataInicial}|${range.dataFinal}`
  const collectedKey = collectedIni && collectedFim ? `${collectedIni}|${collectedFim}` : null
  useEffect(() => {
    if (!touched || !collectedKey || isBusy) return
    if (selectedKey === collectedKey) return
    const t = setTimeout(() => runRef.current(atualizadoEm), AUTO_COLETA_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [touched, selectedKey, collectedKey, isBusy, atualizadoEm])

  const intervaloPendente = Boolean(touched && collectedKey && selectedKey !== collectedKey)

  return (
    <header className="topbar flex shrink-0 items-center gap-3 px-4 md:px-6">
      <div className="hidden min-w-0 md:block">
        <p className="m-0 text-xs font-bold text-[var(--text-secondary)]">Intervalo selecionado</p>
        <p className="m-0 truncate text-xs text-[var(--text-muted)]">
          {formatRangeLabel(range.dataInicial, range.dataFinal)}
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <StatusPill tone={consulta.tone}>{consulta.label}</StatusPill>

        {isBusy && (
          <StatusPill tone="blue">
            Coletando {formatRangeLabel(range.dataInicial, range.dataFinal)}…
          </StatusPill>
        )}
        {!isBusy && intervaloPendente && <StatusPill tone="orange">Novo intervalo — coletando…</StatusPill>}
        {state === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {state === 'timeout' && <StatusPill tone="red">Tempo esgotado</StatusPill>}
        {state === 'error' && <StatusPill tone="red">Falha no webhook</StatusPill>}

        <button
          onClick={() => run(atualizadoEm)}
          disabled={isBusy}
          className="action-button px-3 text-xs font-bold disabled:opacity-60"
          title="Recoleta o intervalo selecionado agora"
        >
          {isBusy ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
    </header>
  )
}
