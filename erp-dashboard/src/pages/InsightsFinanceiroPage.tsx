import { NavLink } from 'react-router-dom'
import { useInsightsFinanceiro } from '../hooks/useInsightsFinanceiro'
import DateRangePicker from '../components/DateRangePicker'
import { EmptyState, LoadingBlock, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

type Bloco = {
  prioridade?: number
  severidade?: 'critico' | 'atencao' | 'ok' | string
  categoria?: string
  titulo?: string
  valor?: string
  conteudo?: string
}
type Indicador = { label?: string; valor?: string; tom?: string }
type Alerta = { tipo?: string; prioridade?: string; titulo?: string; detalhe?: string }
type Recomendacao = {
  acao?: string
  prioridade?: string
  cliente?: string
  motivo?: string
  fundamentacao?: string
  impacto_esperado?: string
}
type GlossarioItem = { termo?: string; definicao?: string }

type Analise = {
  gerado_em?: string
  modelo?: string
  agente?: string
  resumo_executivo?: string
  diagnostico?: string
  metodologia?: string
  saude_financeira?: string
  blocos?: Bloco[]
  indicadores?: Indicador[]
  alertas?: Alerta[]
  recomendacoes?: Recomendacao[]
  glossario?: GlossarioItem[]
  erro?: string
}

const saudeTone: Record<string, 'green' | 'orange' | 'red' | 'muted'> = {
  boa: 'green',
  atencao: 'orange',
  critica: 'red',
  indisponivel: 'muted',
}

const sevTone: Record<string, 'red' | 'orange' | 'green' | 'muted'> = {
  critico: 'red',
  atencao: 'orange',
  ok: 'green',
}

const sevBorder: Record<string, string> = {
  critico: 'border-[var(--danger)]/50',
  atencao: 'border-[var(--accent)]/50',
  ok: 'border-[var(--success)]/40',
}

const toneByPrioridade: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = {
  alta: 'red',
  media: 'orange',
  baixa: 'blue',
}

const tomClass: Record<string, string> = {
  positivo: 'text-[var(--success)]',
  atencao: 'text-[var(--accent)]',
  critico: 'text-[var(--danger)]',
}

function fmtDia(iso?: string) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

export default function InsightsFinanceiroPage() {
  const {
    range,
    setRange,
    applyPreset,
    data,
    loading,
    error,
    state,
    isBusy,
    run,
    refresh,
    limitMsg,
    intervaloPendente,
  } = useInsightsFinanceiro()

  const response = data as Record<string, any> | null
  const analise: Analise | null = response?.analise || null
  const periodoLabel =
    response?.dataInicial && response?.dataFinal
      ? `${fmtDia(response.dataInicial)} a ${fmtDia(response.dataFinal)}`
      : null
  const geradoEm = analise?.gerado_em ? new Date(analise.gerado_em).toLocaleString('pt-BR') : null
  const saude = analise?.saude_financeira
  const blocos = (analise?.blocos || []).filter(b => b.titulo || b.conteudo)

  return (
    <div>
      <PageHeader
        eyebrow="Análise inteligente · Financeiro"
        title="Insights IA Financeiro"
        description="Fernanda (PhD em Finanças) faz uma análise PONTUAL dos eventos financeiros do intervalo selecionado. Workflow dedicado — colete o período e os quadrantes se reorganizam pela prioridade do que ela identificar."
        meta={
          <>
            {periodoLabel && <StatusPill tone="orange">{periodoLabel}</StatusPill>}
            <StatusPill tone="muted">gpt-4o</StatusPill>
            {geradoEm && <StatusPill tone="muted">Gerado {geradoEm}</StatusPill>}
          </>
        }
      />

      {/* Seletor de intervalo PROPRIO desta pagina (independente) */}
      <div className="mb-4">
        <DateRangePicker
          value={range}
          onChange={setRange}
          onPreset={applyPreset}
          note={limitMsg}
          showAtualizar
          onAtualizar={run}
          atualizando={isBusy}
        />
      </div>

      {/* Status da coleta desta pagina */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isBusy && <StatusPill tone="blue">Analisando {fmtDia(range.dataInicial)} a {fmtDia(range.dataFinal)}…</StatusPill>}
        {!isBusy && intervaloPendente && (
          <StatusPill tone="orange">Intervalo alterado — clique em Atualizar para recolher</StatusPill>
        )}
        {state === 'success' && <StatusPill tone="green">Análise atualizada!</StatusPill>}
        {state === 'timeout' && <StatusPill tone="red">Tempo esgotado — tente novamente</StatusPill>}
        {state === 'error' && <StatusPill tone="red">Falha ao iniciar a análise</StatusPill>}
        <button onClick={refresh} className="action-button ml-auto px-4 text-xs font-bold">
          Recarregar
        </button>
      </div>

      {error && !analise ? (
        <Panel title="Análise indisponível" subtitle="A Fernanda ainda não processou este período.">
          <div className="p-6">
            <EmptyState title={error} detail="Selecione o intervalo (máx. 3 meses) e clique em Atualizar." />
          </div>
        </Panel>
      ) : loading && !analise ? (
        <LoadingBlock height="h-40" />
      ) : !analise ? (
        <EmptyState title="Nenhuma análise ainda" detail="Defina o intervalo e clique em Atualizar para gerar a leitura da Fernanda." />
      ) : (
        <>
          {/* Quadrantes DINAMICOS priorizados pela Fernanda */}
          {blocos.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {blocos.map((b, idx) => {
                const sev = String(b.severidade || 'atencao').toLowerCase()
                return (
                  <div
                    key={`${b.titulo}-${idx}`}
                    className={`hover-card overflow-hidden rounded-2xl border ${sevBorder[sev] || 'border-[var(--border)]'} bg-white/[0.03] p-4`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <StatusPill tone={sevTone[sev] || 'muted'}>{sev.toUpperCase()}</StatusPill>
                      {b.categoria && (
                        <span className="break-words text-right text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                          {b.categoria}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{b.titulo}</div>
                    {b.valor && (
                      <div className="mt-1 break-words text-lg font-extrabold tabular-nums text-[var(--accent)]">
                        {b.valor}
                      </div>
                    )}
                    {b.conteudo && (
                      <p className="m-0 mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                        {b.conteudo}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Resumo executivo + saude + diagnostico + metodologia */}
          <Panel title="Fernanda — Resumo financeiro" subtitle="Síntese gerada pelo agente">
            <div className="p-5">
              {saude && (
                <div className="mb-3">
                  <StatusPill tone={saudeTone[saude] || 'muted'}>Saúde: {saude.toUpperCase()}</StatusPill>
                </div>
              )}
              <p className="m-0 text-sm leading-relaxed text-[var(--text-primary)]">
                {analise.resumo_executivo || analise.erro || 'Sem resumo disponível.'}
              </p>

              {analise.diagnostico && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                    Diagnóstico
                  </div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {analise.diagnostico}
                  </p>
                </div>
              )}

              {analise.metodologia && (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Como li os números (metodologia)
                  </div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {analise.metodologia}
                  </p>
                </div>
              )}
            </div>
          </Panel>

          {/* Indicadores */}
          {(analise.indicadores || []).length > 0 && (
            <div className="mt-4">
              <Panel title="Indicadores" subtitle="Métricas-chave lidas pelo agente">
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                  {(analise.indicadores || []).map((ind, idx) => (
                    <div key={`${ind.label}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <div className="break-words text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                        {ind.label}
                      </div>
                      <div className={`mt-1 break-words text-lg font-extrabold tabular-nums ${tomClass[ind.tom || ''] || 'text-[var(--text-primary)]'}`}>
                        {ind.valor}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Alertas + Recomendacoes */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title={`Alertas (${(analise.alertas || []).length})`} subtitle="Itens que exigem atenção">
              <div className="space-y-2 p-4">
                {(analise.alertas || []).length === 0 ? (
                  <EmptyState title="Sem alertas" detail="O agente não sinalizou alertas neste período." />
                ) : (
                  (analise.alertas || []).map((a, idx) => (
                    <div key={`${a.titulo}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[a.prioridade || 'baixa'] || 'muted'}>
                          {(a.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {a.tipo && <StatusPill tone="muted">{a.tipo}</StatusPill>}
                      </div>
                      <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{a.titulo}</div>
                      {a.detalhe && <p className="m-0 mt-2 break-words text-sm text-[var(--text-secondary)]">{a.detalhe}</p>}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title={`Recomendações (${(analise.recomendacoes || []).length})`} subtitle="Ações sugeridas pelo agente">
              <div className="space-y-2 p-4">
                {(analise.recomendacoes || []).length === 0 ? (
                  <EmptyState title="Sem recomendações" detail="O agente não sugeriu ações neste período." />
                ) : (
                  (analise.recomendacoes || []).map((r, idx) => (
                    <div key={`${r.cliente}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[r.prioridade || 'baixa'] || 'muted'}>
                          {(r.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {r.acao && <StatusPill tone="orange">{r.acao}</StatusPill>}
                      </div>
                      <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">
                        {r.cliente || 'Ação geral'}
                      </div>
                      {r.motivo && <p className="m-0 mt-2 break-words text-sm text-[var(--text-secondary)]">{r.motivo}</p>}
                      {r.fundamentacao && (
                        <p className="m-0 mt-1.5 break-words border-l-2 border-[var(--accent)]/40 pl-2 text-xs italic text-[var(--text-muted)]">
                          Por quê: {r.fundamentacao}
                        </p>
                      )}
                      {r.impacto_esperado && (
                        <p className="m-0 mt-1 break-words text-xs text-[var(--text-muted)]">Impacto: {r.impacto_esperado}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Glossario */}
          {(analise.glossario || []).length > 0 && (
            <div className="mt-4">
              <Panel title="Glossário" subtitle="Termos usados na análise, explicados pelo agente">
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {(analise.glossario || []).map((g, idx) => (
                    <div key={`${g.termo}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="break-words text-sm font-extrabold text-[var(--text-primary)]">{g.termo}</div>
                      <p className="m-0 mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{g.definicao}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Navegacao rapida */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NavLink to="/visao-geral" className="action-button flex items-center justify-center px-3 text-xs font-bold">Visão Geral</NavLink>
            <NavLink to="/insights-estoque" className="action-button flex items-center justify-center px-3 text-xs font-bold">IA Estoque</NavLink>
            <NavLink to="/financeiro" className="action-button flex items-center justify-center px-3 text-xs font-bold">Financeiro</NavLink>
            <NavLink to="/vendas" className="action-button flex items-center justify-center px-3 text-xs font-bold">Vendas</NavLink>
          </div>
        </>
      )}
    </div>
  )
}
