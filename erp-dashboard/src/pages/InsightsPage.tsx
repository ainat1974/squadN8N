import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatNum } from '../services/api'
import { EmptyState, LoadingBlock, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

type Indicador = { label?: string; valor?: string; tom?: 'positivo' | 'atencao' | 'critico' | string }
type Alerta = { tipo?: string; prioridade?: string; titulo?: string; detalhe?: string; produto?: string }
type Recomendacao = {
  acao?: string
  prioridade?: string
  produto?: string
  cliente?: string
  motivo?: string
  fundamentacao?: string
  impacto_esperado?: string
}
type GlossarioItem = { termo?: string; definicao?: string }
type Reposicao = {
  produto?: string
  codigo?: string
  variacao?: string
  estoque_atual?: number
  vendido_periodo?: number
  cobertura_dias?: number
  urgencia?: string
}

type Analise = {
  gerado_em?: string
  modelo?: string
  agente?: string
  resumo_executivo?: string
  diagnostico?: string
  metodologia?: string
  saude_financeira?: string
  saude_estoque?: string
  indicadores?: Indicador[]
  alertas?: Alerta[]
  recomendacoes?: Recomendacao[]
  reposicao_urgente?: Reposicao[]
  glossario?: GlossarioItem[]
  erro?: string
}

const toneByPrioridade: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = {
  alta: 'red',
  media: 'orange',
  baixa: 'blue',
}

const saudeTone: Record<string, 'green' | 'orange' | 'red' | 'muted'> = {
  boa: 'green',
  atencao: 'orange',
  critica: 'red',
  indisponivel: 'muted',
}

const tomClass: Record<string, string> = {
  positivo: 'text-[var(--success)]',
  atencao: 'text-[var(--accent)]',
  critico: 'text-[var(--danger)]',
}

type AgenteKey = 'financeiro' | 'pcp'

export default function InsightsPage() {
  const { data, loading, error, refresh } = useErpData(api.insights)
  const [aba, setAba] = useState<AgenteKey>('financeiro')

  const response = data as any
  const d = response?.dados
  const financeiro: Analise | null = d?.financeiro || null
  const pcp: Analise | null = d?.pcp || null
  const geradoEm = (financeiro?.gerado_em || pcp?.gerado_em)
    ? new Date((financeiro?.gerado_em || pcp?.gerado_em) as string).toLocaleString('pt-BR')
    : null

  if (error) {
    return (
      <Panel title="Analises indisponiveis" subtitle="Os agentes ainda nao processaram os dados do periodo.">
        <div className="p-6">
          <EmptyState title={error} detail="Clique em Atualizar na Visao Geral e aguarde o processamento dos agentes." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  const ativa = aba === 'financeiro' ? financeiro : pcp
  const saude = aba === 'financeiro' ? ativa?.saude_financeira : ativa?.saude_estoque

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="Analise inteligente"
        title="Insights dos agentes"
        description="Fernanda (Financeiro) e Paulo (PCP) leem os dados coletados e geram leitura executiva. Os numeros sao deterministicos (workflow); a interpretacao e dos agentes (gpt-4o)."
        meta={
          <>
            <StatusPill tone="orange">gpt-4o</StatusPill>
            {geradoEm && <StatusPill tone="muted">Gerado {geradoEm}</StatusPill>}
          </>
        }
      />

      {/* Abas dos agentes */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setAba('financeiro')}
          className={`period-button px-4 text-sm font-bold ${aba === 'financeiro' ? 'active' : ''}`}
        >
          Fernanda · Financeiro
        </button>
        <button
          onClick={() => setAba('pcp')}
          className={`period-button px-4 text-sm font-bold ${aba === 'pcp' ? 'active' : ''}`}
        >
          Paulo · PCP
        </button>
        <button onClick={refresh} className="action-button ml-auto px-4 text-sm font-bold">
          Atualizar
        </button>
      </div>

      {loading && !d ? (
        <LoadingBlock height="h-40" />
      ) : !ativa ? (
        <EmptyState title="Analise ainda nao gerada" detail="Dispare a coleta na Visao Geral para gerar a leitura deste agente." />
      ) : (
        <>
          {/* Resumo executivo + saude */}
          <Panel
            title={aba === 'financeiro' ? 'Fernanda — Resumo financeiro' : 'Paulo — Resumo de estoque/PCP'}
            subtitle="Sintese gerada pelo agente"
          >
            <div className="p-5">
              {saude && (
                <div className="mb-3">
                  <StatusPill tone={saudeTone[saude] || 'muted'}>Saude: {saude.toUpperCase()}</StatusPill>
                </div>
              )}
              <p className="m-0 text-sm leading-relaxed text-[var(--text-primary)]">
                {ativa.resumo_executivo || ativa.erro || 'Sem resumo disponivel.'}
              </p>

              {ativa.diagnostico && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                    Diagnóstico
                  </div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {ativa.diagnostico}
                  </p>
                </div>
              )}

              {ativa.metodologia && (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Como li os números (metodologia)
                  </div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {ativa.metodologia}
                  </p>
                </div>
              )}
            </div>
          </Panel>

          {/* Indicadores */}
          {(ativa.indicadores || []).length > 0 && (
            <div className="mt-4">
              <Panel title="Indicadores" subtitle="Metricas-chave lidas pelo agente">
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                  {(ativa.indicadores || []).map((ind, idx) => (
                    <div key={`${ind.label}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                        {ind.label}
                      </div>
                      <div className={`mt-1 text-lg font-extrabold ${tomClass[ind.tom || ''] || 'text-[var(--text-primary)]'}`}>
                        {ind.valor}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Reposicao urgente (somente Paulo) */}
          {aba === 'pcp' && (ativa.reposicao_urgente || []).length > 0 && (
            <div className="mt-4">
              <Panel title="Reposicao urgente" subtitle="Variacoes com menor cobertura (risco de ruptura)">
                <div className="overflow-x-auto p-4">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Variação</th>
                        <th className="text-right">Vendido</th>
                        <th className="text-right">Estoque</th>
                        <th className="text-right">Cobertura</th>
                        <th>Urgência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ativa.reposicao_urgente || []).map((r, idx) => (
                        <tr key={`${r.codigo}-${idx}`}>
                          <td className="max-w-[260px] truncate">{r.produto}</td>
                          <td className="text-[var(--text-secondary)]">{r.variacao || '—'}</td>
                          <td className="text-right">{formatNum(Number(r.vendido_periodo || 0))}</td>
                          <td className="text-right font-bold text-[var(--accent)]">{formatNum(Number(r.estoque_atual || 0))}</td>
                          <td className="text-right text-[var(--text-secondary)]">{formatNum(Number(r.cobertura_dias || 0), 1)}d</td>
                          <td>
                            <StatusPill tone={r.urgencia === 'critico' ? 'red' : r.urgencia === 'alto' ? 'orange' : 'muted'}>
                              {(r.urgencia || 'medio').toUpperCase()}
                            </StatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {/* Alertas + Recomendacoes */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title={`Alertas (${(ativa.alertas || []).length})`} subtitle="Itens que exigem atencao">
              <div className="space-y-2 p-4">
                {(ativa.alertas || []).length === 0 ? (
                  <EmptyState title="Sem alertas" detail="O agente nao sinalizou alertas neste periodo." />
                ) : (
                  (ativa.alertas || []).map((a, idx) => (
                    <div key={`${a.titulo}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[a.prioridade || 'baixa'] || 'muted'}>
                          {(a.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {a.tipo && <StatusPill tone="muted">{a.tipo}</StatusPill>}
                      </div>
                      <div className="mt-2 text-sm font-extrabold text-[var(--text-primary)]">{a.titulo}</div>
                      {a.produto && <div className="text-[12px] text-[var(--text-muted)]">{a.produto}</div>}
                      {a.detalhe && <p className="m-0 mt-2 text-sm text-[var(--text-secondary)]">{a.detalhe}</p>}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title={`Recomendacoes (${(ativa.recomendacoes || []).length})`} subtitle="Acoes sugeridas pelo agente">
              <div className="space-y-2 p-4">
                {(ativa.recomendacoes || []).length === 0 ? (
                  <EmptyState title="Sem recomendacoes" detail="O agente nao sugeriu acoes neste periodo." />
                ) : (
                  (ativa.recomendacoes || []).map((r, idx) => (
                    <div key={`${r.produto || r.cliente}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[r.prioridade || 'baixa'] || 'muted'}>
                          {(r.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {r.acao && <StatusPill tone="orange">{r.acao}</StatusPill>}
                      </div>
                      <div className="mt-2 text-sm font-extrabold text-[var(--text-primary)]">
                        {r.produto || r.cliente || 'Acao geral'}
                      </div>
                      {r.motivo && <p className="m-0 mt-2 text-sm text-[var(--text-secondary)]">{r.motivo}</p>}
                      {r.fundamentacao && (
                        <p className="m-0 mt-1.5 border-l-2 border-[var(--accent)]/40 pl-2 text-xs italic text-[var(--text-muted)]">
                          Por quê: {r.fundamentacao}
                        </p>
                      )}
                      {r.impacto_esperado && (
                        <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">Impacto: {r.impacto_esperado}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Glossario didatico */}
          {(ativa.glossario || []).length > 0 && (
            <div className="mt-4">
              <Panel title="Glossário" subtitle="Termos usados na análise, explicados pelo agente">
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {(ativa.glossario || []).map((g, idx) => (
                    <div key={`${g.termo}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="text-sm font-extrabold text-[var(--text-primary)]">{g.termo}</div>
                      <p className="m-0 mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{g.definicao}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Navegacao rapida */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NavLink to="/visao-geral" className="action-button flex items-center justify-center px-3 text-xs font-bold">Visão Geral</NavLink>
            <NavLink to="/vendas" className="action-button flex items-center justify-center px-3 text-xs font-bold">Vendas</NavLink>
            <NavLink to="/estoque" className="action-button flex items-center justify-center px-3 text-xs font-bold">Estoque</NavLink>
            <NavLink to="/financeiro" className="action-button flex items-center justify-center px-3 text-xs font-bold">Financeiro</NavLink>
          </div>
        </>
      )}
    </div>
  )
}
