import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatNum } from '../services/api'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

type Alerta = {
  tipo?: string
  prioridade?: 'alta' | 'media' | 'baixa' | string
  titulo?: string
  detalhe?: string
  produto?: string
  link?: string
}

type Recomendacao = {
  acao?: string
  prioridade?: 'alta' | 'media' | 'baixa' | string
  produto?: string
  motivo?: string
  impacto_esperado?: string
  link?: string
}

type Destaque = {
  titulo?: string
  valor?: string
  tipo?: 'positivo' | 'atencao' | 'critico' | string
}

const toneByPrioridade: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = {
  alta: 'red',
  media: 'orange',
  baixa: 'blue',
}

const destaqueValorClass: Record<string, string> = {
  positivo: 'text-[var(--success)]',
  atencao: 'text-[var(--accent)]',
  critico: 'text-[var(--danger)]',
  muted: 'text-[var(--text-secondary)]',
}

const prioridades = ['todas', 'alta', 'media', 'baixa'] as const
type Prioridade = (typeof prioridades)[number]

export default function InsightsPage() {
  const { data, loading, error, refresh } = useErpData(api.insights)
  const [filtroAlerta, setFiltroAlerta] = useState<Prioridade>('todas')
  const [filtroRec] = useState<Prioridade>('todas')
  const [filtroTipoAlerta, setFiltroTipoAlerta] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  const response = data as any
  const d = response?.dados
  const resumo: string = d?.resumo_executivo || ''
  const destaques: Destaque[] = useMemo(() => d?.destaques || [], [d?.destaques])
  const alertas: Alerta[] = useMemo(() => d?.alertas || [], [d?.alertas])
  const recomendacoes: Recomendacao[] = useMemo(() => d?.recomendacoes || [], [d?.recomendacoes])
  const contexto = d?.contexto || {}
  const geradoEm = d?.gerado_em ? new Date(d.gerado_em).toLocaleString('pt-BR') : null
  const modelo: string = d?.modelo || 'gpt-4o'

  const tiposAlerta = useMemo(() => {
    const set = new Set<string>()
    alertas.forEach(a => a.tipo && set.add(a.tipo))
    return ['todos', ...Array.from(set)]
  }, [alertas])

  const alertasFiltrados = useMemo(() => {
    return alertas.filter(a => {
      if (filtroAlerta !== 'todas' && a.prioridade !== filtroAlerta) return false
      if (filtroTipoAlerta !== 'todos' && a.tipo !== filtroTipoAlerta) return false
      if (busca.trim()) {
        const q = busca.trim().toLowerCase()
        const texto = `${a.titulo || ''} ${a.detalhe || ''} ${a.produto || ''}`.toLowerCase()
        if (!texto.includes(q)) return false
      }
      return true
    })
  }, [alertas, filtroAlerta, filtroTipoAlerta, busca])

  const recsFiltradas = useMemo(() => {
    return recomendacoes.filter(r => {
      if (filtroRec !== 'todas' && r.prioridade !== filtroRec) return false
      if (busca.trim()) {
        const q = busca.trim().toLowerCase()
        const texto = `${r.produto || ''} ${r.motivo || ''} ${r.impacto_esperado || ''} ${r.acao || ''}`.toLowerCase()
        if (!texto.includes(q)) return false
      }
      return true
    })
  }, [recomendacoes, filtroRec, busca])

  if (error) {
    return (
      <Panel title="Insights indisponiveis" subtitle="O Agente IA ainda nao processou os dados do dia.">
        <div className="p-6">
          <EmptyState title={error} detail="Execute a coleta manual e aguarde o processamento do agente." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="Analise inteligente"
        title="Insights do dia"
        description="Resumo executivo, alertas e recomendacoes geradas pelo agente IA com base nos dados consolidados do D-1. Os numeros sao deterministicos (workflow), a leitura semantica e do agente."
        meta={
          <>
            <StatusPill tone="orange">{modelo}</StatusPill>
            {geradoEm && <StatusPill tone="muted">Gerado {geradoEm}</StatusPill>}
          </>
        }
      />

      {/* Navegação rápida */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NavLink to="/visao-geral" className="action-button flex items-center justify-center px-3 text-xs font-bold">
          Visão Geral
        </NavLink>
        <NavLink to="/vendas" className="action-button flex items-center justify-center px-3 text-xs font-bold">
          Ver Vendas
        </NavLink>
        <NavLink to="/estoque" className="action-button flex items-center justify-center px-3 text-xs font-bold">
          Ver Estoque
        </NavLink>
        <button
          onClick={refresh}
          className="action-button flex items-center justify-center px-3 text-xs font-bold"
        >
          Atualizar Insights
        </button>
      </div>

      {loading && !d ? (
        <LoadingBlock height="h-40" />
      ) : (
        <>
          {/* Resumo executivo */}
          {resumo && (
            <Panel title="Resumo executivo" subtitle="Sintese do dia gerada pelo agente">
              <div className="p-5 text-sm leading-relaxed text-[var(--text-primary)]">
                {resumo}
              </div>
            </Panel>
          )}

          {/* Contexto numérico */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Receita do dia"
              value={formatBRL(contexto.receita_total || 0)}
              detail={`${formatNum(contexto.volume_vendas || 0)} vendas`}
              tone="orange"
            />
            <MetricCard
              label="SKUs vendidos"
              value={formatNum(contexto.total_skus || 0)}
              detail={`${formatNum(contexto.total_grupos || 0)} grupos top 10`}
              tone="blue"
            />
            <MetricCard
              label="Alertas IA"
              value={formatNum(alertas.length)}
              detail={`${alertas.filter(a => a.prioridade === 'alta').length} prioridade alta`}
              tone="red"
            />
            <MetricCard
              label="Recomendações IA"
              value={formatNum(recomendacoes.length)}
              detail={`${recomendacoes.filter(r => r.prioridade === 'alta').length} prioridade alta`}
              tone="green"
            />
          </div>

          {/* Destaques */}
          {destaques.length > 0 && (
            <div className="mt-4">
              <Panel title="Destaques" subtitle="Numeros que merecem leitura prioritaria">
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {destaques.map((dest, idx) => {
                    const valorClass = destaqueValorClass[dest.tipo || 'positivo'] || destaqueValorClass.muted
                    return (
                      <div
                        key={`${dest.titulo}-${idx}`}
                        className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3"
                      >
                        <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                          {dest.titulo}
                        </div>
                        <div className={`mt-1 text-lg font-extrabold ${valorClass}`}>
                          {dest.valor}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* Filtros */}
          <div className="mt-4">
            <Panel title="Filtros" subtitle="Refine a leitura por prioridade, tipo e palavras-chave">
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Prioridade dos alertas
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {prioridades.map(p => (
                      <button
                        key={p}
                        onClick={() => setFiltroAlerta(p)}
                        className={`period-button px-3 text-xs font-bold ${filtroAlerta === p ? 'active' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Tipo de alerta
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tiposAlerta.map(t => (
                      <button
                        key={t}
                        onClick={() => setFiltroTipoAlerta(t)}
                        className={`period-button px-3 text-xs font-bold ${filtroTipoAlerta === t ? 'active' : ''}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Buscar
                  </label>
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="produto, palavra-chave..."
                    className="mt-2 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
            </Panel>
          </div>

          {/* Alertas + Recomendações */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel
              title={`Alertas (${alertasFiltrados.length})`}
              subtitle="Itens que precisam de atencao operacional"
            >
              <div className="space-y-2 p-4">
                {alertasFiltrados.length === 0 ? (
                  <EmptyState title="Nenhum alerta neste filtro" detail="Ajuste os filtros acima." />
                ) : (
                  alertasFiltrados.map((a, idx) => {
                    const tone = toneByPrioridade[a.prioridade || 'baixa'] || 'muted'
                    return (
                      <div
                        key={`${a.titulo}-${idx}`}
                        className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={tone}>{(a.prioridade || 'baixa').toUpperCase()}</StatusPill>
                              {a.tipo && <StatusPill tone="muted">{a.tipo}</StatusPill>}
                            </div>
                            <div className="mt-2 text-sm font-extrabold text-[var(--text-primary)]">
                              {a.titulo}
                            </div>
                            {a.produto && (
                              <div className="text-[12px] text-[var(--text-muted)]">{a.produto}</div>
                            )}
                            {a.detalhe && (
                              <p className="m-0 mt-2 text-sm text-[var(--text-secondary)]">{a.detalhe}</p>
                            )}
                          </div>
                          {a.link && (
                            <NavLink
                              to={a.link}
                              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
                            >
                              Ver →
                            </NavLink>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Panel>

            <Panel
              title={`Recomendações (${recsFiltradas.length})`}
              subtitle="Acoes sugeridas pelo agente"
            >
              <div className="space-y-2 p-4">
                {recsFiltradas.length === 0 ? (
                  <EmptyState title="Nenhuma recomendação neste filtro" detail="Ajuste os filtros acima." />
                ) : (
                  recsFiltradas.map((r, idx) => {
                    const tone = toneByPrioridade[r.prioridade || 'baixa'] || 'muted'
                    return (
                      <div
                        key={`${r.produto}-${idx}`}
                        className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={tone}>{(r.prioridade || 'baixa').toUpperCase()}</StatusPill>
                              {r.acao && <StatusPill tone="orange">{r.acao}</StatusPill>}
                            </div>
                            <div className="mt-2 text-sm font-extrabold text-[var(--text-primary)]">
                              {r.produto || 'Ação geral'}
                            </div>
                            {r.motivo && (
                              <p className="m-0 mt-2 text-sm text-[var(--text-secondary)]">{r.motivo}</p>
                            )}
                            {r.impacto_esperado && (
                              <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
                                Impacto: {r.impacto_esperado}
                              </p>
                            )}
                          </div>
                          {r.link && (
                            <NavLink
                              to={r.link}
                              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
                            >
                              Ver →
                            </NavLink>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
