import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { NavLink } from 'react-router-dom'
import { useOverview } from '../hooks/useOverview'
import { formatBRL, formatNum } from '../services/api'
import { formatRangeLabel } from '../utils/dateRange'
import { EmptyState, LoadingBlock, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'
import DateRangePicker from '../components/DateRangePicker'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)

// Abrevia numeros: 1234567 -> 1,2M / 4500 -> 4,5k
function abbreviateNumber(value: number): string {
  if (value == null || Number.isNaN(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace('.0', '').replace('.', ',') + 'B'
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',') + 'M'
  if (abs >= 1_000) return (value / 1_000).toFixed(1).replace('.0', '').replace('.', ',') + 'k'
  return String(Math.round(value))
}

// Plugin Chart.js que escreve o valor (abreviado) sobre cada barra.
const valueOnBarsPlugin = {
  id: 'valueOnBars',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart
    chart.data.datasets.forEach((dataset: any, di: number) => {
      const meta = chart.getDatasetMeta(di)
      if (!meta || meta.hidden) return
      meta.data.forEach((bar: any, idx: number) => {
        const v = Number(dataset.data[idx] || 0)
        if (!v) return
        ctx.save()
        ctx.fillStyle = '#e5e5e5'
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(abbreviateNumber(v), bar.x, bar.y - 6)
        ctx.restore()
      })
    })
  },
}

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 18 } },
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#747474', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.06)' } },
    y: {
      ticks: {
        color: '#747474',
        font: { size: 11 },
        callback: (v: any) => abbreviateNumber(Number(v)),
      },
      grid: { color: 'rgba(255,255,255,.06)' },
    },
  },
}

type Kpi = { id: string; label: string; valor: number; formato?: string; variacao?: number | null; detalhe?: string; tom?: string }
type Prioridade = { severidade?: string; categoria?: string; titulo?: string; valor?: string; conteudo?: string; link?: string }
type SaudeArea = { status?: string; ancora?: string; detalhe?: string; link?: string }
type Recomendacao = { prioridade?: string; area?: string; acao?: string; fundamentacao?: string; impacto?: string }

// =====================================================================
// PREVIEW: Top 10 Clientes com dados REAIS coletados via probe ao
// endpoint /v1/vendaspdv (que traz Cliente identificado). Ainda nao
// integrado ao workflow — aguardando aprovacao visual.
// =====================================================================
const PREVIEW_TOP_CLIENTES = false
const TOP_CLIENTES_MOCK = [
  { cliente: 'VINICIUS TAKAGI REIS', valor_total: 44451.0, vendas: 3 },
  { cliente: 'DENIS COSTA', valor_total: 44249.1, vendas: 6 },
  { cliente: 'ANTONIO RENATO BETTANIN LTDA', valor_total: 39882.9, vendas: 13 },
  { cliente: 'JOAO VITOR BISCO DE SOUZA', valor_total: 15933.1, vendas: 6 },
  { cliente: 'ANA PAULA PIAI', valor_total: 10295.5, vendas: 4 },
  { cliente: 'FRANCIMARA VALERIA PEREIRA', valor_total: 6284.7, vendas: 2 },
  { cliente: 'VAREJO', valor_total: 6164.3, vendas: 74 },
  { cliente: 'BR MOLETON LTDA', valor_total: 5615.1, vendas: 11 },
  { cliente: 'CAIO RHEDA GARCIA', valor_total: 5134.5, vendas: 2 },
  { cliente: 'LUBRI10 COMERCIO DE PECAS E LUBRIFICANTES LTDA', valor_total: 4886.0, vendas: 1 },
]

// =====================================================================
// DIEGO — Diretor Executivo cross-domain (workflow Visao Geral).
// Fonte real: d.analise (gerado pelo agente gpt-4o no N8N).
// PREVIEW_DIEGO=true regride a UI para o mock visual de referencia.
// =====================================================================
const PREVIEW_DIEGO = false
const DIEGO_MOCK = {
  agente: 'Diego — Diretor Executivo',
  modelo: 'gpt-4o',
  resumo_executivo:
    'No intervalo analisado, a empresa entrega caixa saudável e receita estável, mas carrega um risco oculto sério: 100% dos recebíveis em aberto estão vencidos e 93,8% concentrados em um único cliente (ECOMMERCE TECHMALHAS). O estoque mostra sinais de descompasso com a velocidade de venda. Decisão #1 agora: cobrança ativa do cliente concentrador.',
  diagnostico:
    'O retrato cross-domain revela um padrão clássico de armadilha de carteira: o caixa do período (à vista/cartão/pix) mascara um problema estrutural de recebíveis a prazo. Se o ECOMMERCE TECHMALHAS atrasar mais, o capital de giro será impactado em 2-3 semanas — mesmo com vendas estáveis. Em paralelo, o crescimento de SKUs em atenção sem aumento proporcional de venda sugere mix descalibrado, não problema de demanda. As três áreas estão conectadas: financeiro (concentração), comercial (carteira), PCP (mix).',
  blocos: [
    {
      severidade: 'critico',
      categoria: 'Risco financeiro + cliente',
      titulo: '100% dos recebíveis vencidos, 93,8% em um único cliente',
      valor: 'R$ 124.304,40',
      conteudo:
        'A concentração extrema em ECOMMERCE TECHMALHAS é o risco número um do negócio agora. Acionar cobrança e revisar limite de crédito desse cliente são prioridades imediatas — antes que o caixa sinta.',
      link: '/insights-financeiro',
    },
    {
      severidade: 'atencao',
      categoria: 'Vendas × Estoque',
      titulo: 'Estoque em atenção cresce sem reação proporcional na venda',
      valor: '8 SKUs em alerta',
      conteudo:
        'Receita estável mas estoque crítico/em atenção subindo sugere mix descalibrado (cor/tamanho errado, não falta de demanda). Validar com Paulo (PCP) quais variações estão paradas e revisar reposição.',
      link: '/estoque',
    },
    {
      severidade: 'ok',
      categoria: 'Caixa',
      titulo: 'Fluxo de caixa do período se mantém positivo',
      valor: 'R$ 612.151,33',
      conteudo:
        'O ritmo de recebimento à vista compensou os atrasos em recebíveis. Saudável no curto prazo, mas frágil se a inadimplência persistir — atenção ao mês seguinte.',
      link: '/financeiro',
    },
  ] as Prioridade[],
  recomendacoes: [
    {
      prioridade: 'alta',
      area: 'Financeiro / Comercial',
      acao: 'Acionar cobrança ativa do ECOMMERCE TECHMALHAS hoje',
      fundamentacao:
        '93,8% de concentração + 100% vencido = risco iminente de ruptura de capital de giro. Reduzir DSO desse cliente é a alavanca de maior impacto.',
      impacto: 'Recuperar até ~R$ 116k em 30 dias',
    },
    {
      prioridade: 'alta',
      area: 'PCP / Estoque',
      acao: 'Revisar mix dos SKUs em atenção (cobertura > 30d)',
      fundamentacao:
        'Estoque parado consome capital. Validar se é problema de variação (cor/tamanho) e não de demanda real — vendas estão estáveis.',
      impacto: 'Liberar capital e reduzir obsolescência',
    },
    {
      prioridade: 'media',
      area: 'Comercial / Estratégico',
      acao: 'Diversificar carteira B2B em 90 dias',
      fundamentacao:
        'Dependência de um único cliente é vulnerabilidade estratégica — mesmo que ele pague em dia, o risco continua existindo.',
      impacto: 'Reduzir concentração para < 40% da carteira',
    },
  ] as Recomendacao[],
}
// =====================================================================
// FIM DO PREVIEW (será substituído pelo agente real no workflow)
// =====================================================================

const tomClass: Record<string, string> = {
  positivo: 'text-[var(--success)]',
  atencao: 'text-[var(--accent)]',
  critico: 'text-[var(--danger)]',
  muted: 'text-[var(--text-primary)]',
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

const statusLabel: Record<string, string> = { ok: 'OK', atencao: 'ATENÇÃO', critico: 'CRÍTICO' }

function fmtDia(iso?: string) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

/** CK-OV-1: anexa o intervalo coletado como query string para que a pagina
 *  destino aplique o mesmo periodo automaticamente. */
function withRange(path: string | undefined, di?: string, df?: string) {
  if (!path) return path
  if (!di || !df) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}dataInicial=${di}&dataFinal=${df}`
}

function VariacaoBadge({ v }: { v?: number | null }) {
  if (v == null) return <span className="text-[11px] text-[var(--text-muted)]">sem comparativo</span>
  const up = v >= 0
  return (
    <span className={`text-xs font-extrabold ${up ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
      {up ? '▲' : '▼'} {Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      <span className="ml-1 font-normal text-[var(--text-muted)]">vs período anterior</span>
    </span>
  )
}

export default function OverviewPage() {
  const { range, setRange, data, loading, error, state, isBusy, run, limitMsg, intervaloPendente } = useOverview()

  const d = data as Record<string, any> | null
  const kpis: Kpi[] = d?.kpis || []
  const prioridades: Prioridade[] = d?.prioridades || []
  const saude: Record<string, SaudeArea> = d?.saude || {}
  const graficos = d?.graficos || {}
  const tabelas = d?.tabelas || {}
  const periodoLabel = d?.dataInicial && d?.dataFinal ? formatRangeLabel(d.dataInicial, d.dataFinal) : null

  // Diego (cross-domain) — preferencia: PREVIEW (mock) > backend real.
  // Quando o agente real falha no n8n, "diego" fica null e a UI usa
  // o fallback deterministico da Central de Prioridades sem traumas.
  const analiseDiego = d?.analise as Record<string, any> | null
  const diego = PREVIEW_DIEGO
    ? DIEGO_MOCK
    : analiseDiego && (analiseDiego.resumo_executivo || (Array.isArray(analiseDiego.blocos) && analiseDiego.blocos.length > 0))
      ? {
          agente: analiseDiego.agente || 'Diego — Diretor Executivo',
          modelo: analiseDiego.modelo || 'gpt-4o',
          resumo_executivo: analiseDiego.resumo_executivo || '',
          diagnostico: analiseDiego.diagnostico || '',
          blocos: ((analiseDiego.blocos as any[]) || []).map((b) => ({
            severidade: String(b.severidade || 'atencao').toLowerCase(),
            categoria: b.categoria,
            titulo: b.titulo,
            valor: b.valor,
            conteudo: b.conteudo,
            link:
              b.area === 'vendas'
                ? '/vendas'
                : b.area === 'estoque'
                  ? '/estoque'
                  : b.area === 'financeiro'
                    ? '/financeiro'
                    : '/insights-financeiro',
          })) as Prioridade[],
          recomendacoes: ((analiseDiego.recomendacoes as any[]) || []).map((r) => ({
            prioridade: r.prioridade,
            area: r.area,
            acao: r.acao,
            fundamentacao: r.fundamentacao,
            impacto: r.impacto_esperado || r.impacto,
          })) as Recomendacao[],
        }
      : null
  const anteriorLabel = d?.periodoAnterior?.inicio
    ? formatRangeLabel(d.periodoAnterior.inicio, d.periodoAnterior.fim)
    : null

  const receitaDiaria: Array<Record<string, any>> = graficos.receita_diaria || []
  const caixa = graficos.caixa || {}

  const areas: { key: string; label: string }[] = [
    { key: 'vendas', label: 'Vendas' },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'estoque', label: 'Estoque' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="ERP Dapic / Command Center"
        title="Visão Geral Executiva"
        description="Landing de decisão: KPIs do intervalo com variação vs. período anterior e prioridades automáticas. Vendas e caixa seguem o intervalo; o estoque é a posição atual (snapshot)."
        meta={
          <>
            {periodoLabel && <StatusPill tone="orange">{periodoLabel}</StatusPill>}
            {anteriorLabel && <StatusPill tone="muted">Comparado a {anteriorLabel}</StatusPill>}
          </>
        }
      />

      <div className="mb-4">
        <DateRangePicker
          value={range}
          onChange={setRange}
          note={limitMsg}
          hidePresets
          showAtualizar
          onAtualizar={run}
          atualizando={isBusy}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isBusy && <StatusPill tone="blue">Coletando {fmtDia(range.dataInicial)} a {fmtDia(range.dataFinal)}…</StatusPill>}
        {!isBusy && intervaloPendente && (
          <StatusPill tone="orange">Intervalo alterado — clique em Atualizar</StatusPill>
        )}
        {state === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {state === 'timeout' && <StatusPill tone="red">Tempo esgotado — tente novamente</StatusPill>}
        {state === 'error' && <StatusPill tone="red">Falha ao iniciar coleta</StatusPill>}
      </div>

      {error && !d ? (
        <Panel title="Visão Geral indisponível" subtitle="Ainda não há coleta para este intervalo.">
          <div className="p-6">
            <EmptyState title={error} detail="Selecione o intervalo (máx. 3 meses) e clique em Atualizar." />
          </div>
        </Panel>
      ) : loading && !d ? (
        <LoadingBlock height="h-40" />
      ) : !d ? (
        <EmptyState title="Nenhuma coleta ainda" detail="Defina o intervalo e clique em Atualizar." />
      ) : (
        <>
          {/* 1. Faixa de KPIs com variacao */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {kpis.map(k => (
              <div key={k.id} className="hover-card overflow-hidden rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
                <div className="break-words text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">{k.label}</div>
                <div className={`mt-1 break-words text-xl font-extrabold tabular-nums ${tomClass[k.tom || 'muted'] || 'text-[var(--text-primary)]'}`}>
                  {k.formato === 'moeda' ? formatBRL(Number(k.valor || 0)) : formatNum(Number(k.valor || 0))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {k.variacao !== undefined ? <VariacaoBadge v={k.variacao} /> : null}
                  {k.detalhe && <span className="break-words text-[11px] text-[var(--text-muted)]">{k.detalhe}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ===== Diretor Executivo (Diego) — leitura cross-domain ===== */}
          {diego && (
            <>
              <div className={`mt-4 ${PREVIEW_DIEGO ? 'rounded-2xl border border-dashed border-[var(--accent)]/50 bg-[var(--accent-soft)]/30 p-4' : ''}`}>
                {PREVIEW_DIEGO && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusPill tone="orange">PREVIEW</StatusPill>
                    <span className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                      Mock visual — fonte oficial é d.analise do workflow Visão Geral
                    </span>
                  </div>
                )}

                <Panel title={diego.agente} subtitle="Leitura cross-domain do período (vendas + caixa + estoque)">
                  <div className="p-5">
                    {diego.resumo_executivo && (
                      <p className="m-0 text-sm leading-relaxed text-[var(--text-primary)]">{diego.resumo_executivo}</p>
                    )}
                    {diego.diagnostico && (
                      <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                        <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                          Diagnóstico cross-domain
                        </div>
                        <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{diego.diagnostico}</p>
                      </div>
                    )}
                  </div>
                </Panel>

                <div className="mt-4">
                  <Panel title="Central de Prioridades (priorizada pelo Diego)" subtitle="Blocos cross-domain ordenados por severidade pelo agente">
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                      {diego.blocos.map((b, idx) => {
                        const sev = String(b.severidade || 'atencao').toLowerCase()
                        return (
                          <div
                            key={`diego-${idx}`}
                            className={`hover-card flex flex-col overflow-hidden rounded-2xl border ${sevBorder[sev] || 'border-[var(--border)]'} bg-white/[0.03] p-4`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                              <StatusPill tone={sevTone[sev] || 'muted'}>{(statusLabel[sev] || sev).toUpperCase()}</StatusPill>
                              {b.categoria && (
                                <span className="break-words text-right text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">{b.categoria}</span>
                              )}
                            </div>
                            <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{b.titulo}</div>
                            {b.valor && (
                              <div className="mt-1 break-words text-lg font-extrabold tabular-nums text-[var(--accent)]">
                                {b.valor}
                              </div>
                            )}
                            {b.conteudo && (
                              <p className="m-0 mt-2 flex-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                                {b.conteudo}
                              </p>
                            )}
                            {b.link && sev !== 'ok' && (
                              <NavLink to={withRange(b.link, d?.dataInicial, d?.dataFinal) || b.link} className="action-button mt-3 flex items-center justify-center px-3 text-xs font-bold">
                                Ver detalhe
                              </NavLink>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Panel>
                </div>

                <div className="mt-4">
                  <Panel title="Recomendações Executivas (Diego)" subtitle="Ações priorizadas cross-domain, com fundamentação e impacto esperado">
                    <div className="space-y-2 p-4">
                      {diego.recomendacoes.map((r, idx) => (
                        <div key={`rec-${idx}`} className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone={r.prioridade === 'alta' ? 'red' : r.prioridade === 'media' ? 'orange' : 'blue'}>
                              {(r.prioridade || 'media').toUpperCase()}
                            </StatusPill>
                            {r.area && <StatusPill tone="muted">{r.area}</StatusPill>}
                          </div>
                          <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{r.acao}</div>
                          {r.fundamentacao && (
                            <p className="m-0 mt-1.5 break-words border-l-2 border-[var(--accent)]/40 pl-2 text-xs italic text-[var(--text-muted)]">
                              Por quê: {r.fundamentacao}
                            </p>
                          )}
                          {r.impacto && (
                            <p className="m-0 mt-1 break-words text-xs text-[var(--text-muted)]">Impacto: {r.impacto}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          )}
          {/* ===== FIM DO PREVIEW DIEGO ===== */}

          {/* 2. Central de Prioridades (versão determinística — fallback se o Diego não estiver disponível) */}
          {!diego && (
          <div className="mt-4">
            <Panel
              title="Central de Prioridades"
              subtitle="O que merece sua atenção agora — calculada por regras de severidade"
            >
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {prioridades.map((p, idx) => {
                  const sev = String(p.severidade || 'atencao').toLowerCase()
                  return (
                    <div key={`${p.titulo}-${idx}`} className={`hover-card flex flex-col overflow-hidden rounded-2xl border ${sevBorder[sev] || 'border-[var(--border)]'} bg-white/[0.03] p-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <StatusPill tone={sevTone[sev] || 'muted'}>{(statusLabel[sev] || sev).toUpperCase()}</StatusPill>
                        {p.categoria && (
                          <span className="break-words text-right text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">{p.categoria}</span>
                        )}
                      </div>
                      <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{p.titulo}</div>
                      {p.valor && (
                        <div className="mt-1 break-words text-lg font-extrabold tabular-nums text-[var(--accent)]">
                          {p.valor}
                        </div>
                      )}
                      {p.conteudo && (
                        <p className="m-0 mt-2 flex-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                          {p.conteudo}
                        </p>
                      )}
                      {p.link && sev !== 'ok' && (
                        <NavLink to={withRange(p.link, d?.dataInicial, d?.dataFinal) || p.link} className="action-button mt-3 flex items-center justify-center px-3 text-xs font-bold">
                          Ver detalhe
                        </NavLink>
                      )}
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
          )}

          {/* 3. Saude por area (semaforo) */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {areas.map(a => {
              const s = saude[a.key] || {}
              const st = String(s.status || 'ok').toLowerCase()
              return (
                <div key={a.key} className={`hover-card overflow-hidden rounded-2xl border ${sevBorder[st] || 'border-[var(--border)]'} bg-white/[0.03] p-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="break-words text-sm font-extrabold text-[var(--text-primary)]">{a.label}</span>
                    <StatusPill tone={sevTone[st] || 'muted'}>{statusLabel[st] || st.toUpperCase()}</StatusPill>
                  </div>
                  <div className="mt-2 break-words text-base font-extrabold tabular-nums text-[var(--text-primary)]">{s.ancora}</div>
                  {s.detalhe && <div className="break-words text-xs text-[var(--text-muted)]">{s.detalhe}</div>}
                  {s.link && (
                    <NavLink to={withRange(s.link, d?.dataInicial, d?.dataFinal) || s.link} className="action-button mt-3 flex items-center justify-center px-3 text-xs font-bold">
                      Abrir {a.label}
                    </NavLink>
                  )}
                </div>
              )
            })}
          </div>

          {/* 4. Top Clientes + Top Produtos (novos cards) */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel
              title="Top 10 clientes que mais compraram"
              subtitle={periodoLabel ? `Ranking em ${periodoLabel}` : 'Ranking do período'}
            >
              <div className="p-4">
                {PREVIEW_TOP_CLIENTES && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--accent)]/50 bg-[var(--accent-soft)]/30 p-2">
                    <StatusPill tone="orange">PREVIEW</StatusPill>
                    <span className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                      Amostra real do endpoint /v1/vendaspdv (cabeçalho com Cliente) · ainda não no workflow
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  {(PREVIEW_TOP_CLIENTES ? TOP_CLIENTES_MOCK : graficos.top_clientes || []).length > 0 ? (
                    <table className="data-table min-w-full">
                      <thead>
                        <tr>
                          <th className="w-10">#</th>
                          <th>Cliente</th>
                          <th className="text-right whitespace-nowrap">Vendas</th>
                          <th className="text-right whitespace-nowrap">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(PREVIEW_TOP_CLIENTES ? TOP_CLIENTES_MOCK : graficos.top_clientes || [])
                          .slice(0, 10)
                          .map((c: Record<string, any>, idx: number) => (
                            <tr key={`${c.cliente}-${idx}`}>
                              <td className="font-bold text-[var(--text-muted)]">{idx + 1}</td>
                              <td className="break-words">{c.cliente || 'Cliente sem cadastro'}</td>
                              <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatNum(Number(c.vendas || 0))}</td>
                              <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">{formatBRL(Number(c.valor_total || 0))}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState title="Sem clientes no período" detail="Atualize para coletar o intervalo." />
                  )}
                </div>
              </div>
            </Panel>

            <Panel title="Top 10 produtos mais vendidos" subtitle={periodoLabel ? `Ranking em ${periodoLabel}` : 'Ranking do período'}>
              <div className="overflow-x-auto p-4">
                {(graficos.top_produtos || []).length > 0 ? (
                  <table className="data-table min-w-full">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>Produto</th>
                        <th className="text-right whitespace-nowrap">Qtd</th>
                        <th className="text-right whitespace-nowrap">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(graficos.top_produtos || []).slice(0, 10).map((p: Record<string, any>, idx: number) => (
                        <tr key={`${p.codigo}-${idx}`}>
                          <td className="text-[var(--text-muted)] font-bold">{idx + 1}</td>
                          <td className="break-words">{p.produto}</td>
                          <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatNum(Number(p.quantidade || 0))}</td>
                          <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">{formatBRL(Number(p.valor_total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState title="Sem produtos no período" detail="Atualize para coletar o intervalo." />
                )}
              </div>
            </Panel>
          </div>

          {/* 5. Graficos */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Receita por dia" subtitle={periodoLabel ? `Evolução em ${periodoLabel}` : 'Evolução do período'}>
              <div className="h-64 p-4">
                {receitaDiaria.length > 0 ? (
                  <Bar
                    data={{
                      labels: receitaDiaria.map(x => fmtDia(String(x.data)).slice(0, 5)),
                      datasets: [{ label: 'Receita', data: receitaDiaria.map(x => Number(x.receita || 0)), backgroundColor: '#ff7a2f', borderRadius: 4 }],
                    }}
                    options={chartBase as object}
                    plugins={[valueOnBarsPlugin]}
                  />
                ) : (
                  <EmptyState title="Sem vendas no período" detail="Atualize para coletar o intervalo." />
                )}
              </div>
            </Panel>

            <Panel title="Caixa" subtitle="Recebido no período × a receber em aberto">
              <div className="h-64 p-4">
                {(Number(caixa.recebido || 0) > 0 || Number(caixa.a_receber || 0) > 0) ? (
                  <Bar
                    data={{
                      labels: ['Recebido', 'A receber'],
                      datasets: [{ label: 'Valor', data: [Number(caixa.recebido || 0), Number(caixa.a_receber || 0)], backgroundColor: ['#42d392', '#ff7a2f'], borderRadius: 5 }],
                    }}
                    options={chartBase as object}
                    plugins={[valueOnBarsPlugin]}
                  />
                ) : (
                  <EmptyState title="Sem movimentação financeira" detail="O módulo financeiro não retornou dados para o período." />
                )}
              </div>
            </Panel>
          </div>

          {/* 6. Tabelas de apoio */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Estoque em atenção" subtitle="Posição atual (não filtra por período) · até 30 itens">
              <div className="p-4">
                {(tabelas.estoque_atencao || []).length > 0 ? (
                  <div className="max-h-[520px] overflow-auto pr-1">
                    <table className="data-table min-w-full">
                      <thead className="sticky top-0 z-10 bg-[var(--bg-panel)]">
                        <tr>
                          <th>Produto</th>
                          <th>Variação</th>
                          <th className="text-right whitespace-nowrap">Vendido</th>
                          <th className="text-right whitespace-nowrap">Estoque</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tabelas.estoque_atencao || []).slice(0, 30).map((item: Record<string, any>, idx: number) => (
                          <tr key={`${item.codigo}-${idx}`}>
                            <td className="break-words">{item.produto}</td>
                            <td className="break-words text-[var(--text-muted)]">{[item.cor, item.tamanho].filter(Boolean).join(' / ') || '—'}</td>
                            <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatNum(Number(item.vendido_hoje || 0))}</td>
                            <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">{formatNum(Number(item.estoque_atual || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyState title="Sem estoque para listar" detail="O módulo de estoque não retornou variações." />}
              </div>
            </Panel>

            <Panel title="Parcelas próximas" subtitle="Recebíveis vencendo nos próximos 7 dias">
              <div className="p-4">
                {(() => {
                  const parcelas: Record<string, any>[] = tabelas.parcelas_proximas || []
                  if (parcelas.length === 0) {
                    return <EmptyState title="Sem parcelas próximas" detail="A coleta não retornou recebíveis a vencer." />
                  }
                  const hoje = new Date()
                  hoje.setHours(0, 0, 0, 0)
                  const diasAteVencer = (iso?: string) => {
                    if (!iso) return 0
                    const d = new Date(iso + 'T00:00:00')
                    return Math.max(0, Math.round((d.getTime() - hoje.getTime()) / 86_400_000))
                  }
                  const total = parcelas.reduce((s, p) => s + Number(p.valor ?? p.valor_aberto ?? 0), 0)
                  const maior = parcelas.reduce<Record<string, any> | null>(
                    (m, p) => (!m || Number(p.valor || 0) > Number(m.valor || 0) ? p : m),
                    null,
                  )
                  const toneDias = (n: number): 'red' | 'orange' | 'blue' =>
                    n <= 2 ? 'red' : n <= 5 ? 'orange' : 'blue'

                  return (
                    <>
                      {/* KPI strip — novo indicador sugerido pelo agente */}
                      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                          <div className="break-words text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">Total a receber 7d</div>
                          <div className="mt-1 break-words text-base font-extrabold tabular-nums text-[var(--success)]">{formatBRL(total)}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{parcelas.length} parcela(s)</div>
                        </div>
                        <div className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                          <div className="break-words text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">Maior parcela</div>
                          <div className="mt-1 break-words text-base font-extrabold tabular-nums text-[var(--accent)]">{formatBRL(Number(maior?.valor || 0))}</div>
                          <div className="line-clamp-2 break-words text-[10px] text-[var(--text-muted)]">{String(maior?.cliente || maior?.pessoa || '—')}</div>
                        </div>
                        <div className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                          <div className="break-words text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">Mais urgente</div>
                          <div className="mt-1 break-words text-base font-extrabold tabular-nums text-[var(--danger)]">
                            {diasAteVencer(parcelas[0]?.data_vencimento) === 0 ? 'Hoje' : `Em ${diasAteVencer(parcelas[0]?.data_vencimento)}d`}
                          </div>
                          <div className="line-clamp-2 break-words text-[10px] text-[var(--text-muted)]">{String(parcelas[0]?.cliente || '—')}</div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="data-table min-w-full">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th className="text-center whitespace-nowrap">Em</th>
                              <th className="text-right whitespace-nowrap">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((item, idx) => {
                              const n = diasAteVencer(item.data_vencimento)
                              return (
                                <tr key={`${item.id}-${idx}`}>
                                  <td className="break-words">{item.cliente || item.pessoa || 'Pessoa não informada'}</td>
                                  <td className="text-center whitespace-nowrap">
                                    <StatusPill tone={toneDias(n)}>{n === 0 ? 'Hoje' : `${n}d`}</StatusPill>
                                  </td>
                                  <td className="text-right font-bold text-[var(--success)] whitespace-nowrap">{formatBRL(Number(item.valor ?? item.valor_aberto ?? 0))}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}
              </div>
            </Panel>
          </div>

          {/* Navegacao */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NavLink to="/vendas" className="action-button flex items-center justify-center px-3 text-xs font-bold">Vendas</NavLink>
            <NavLink to="/estoque" className="action-button flex items-center justify-center px-3 text-xs font-bold">Estoque</NavLink>
            <NavLink to="/financeiro" className="action-button flex items-center justify-center px-3 text-xs font-bold">Financeiro</NavLink>
            <NavLink to="/insights-financeiro" className="action-button flex items-center justify-center px-3 text-xs font-bold">IA Financeiro</NavLink>
          </div>

          {d?.gerado_em && (
            <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
              Coletado em {new Date(d.atualizadoEm || d.gerado_em).toLocaleString('pt-BR')} · dados determinísticos (sem IA nesta página)
            </p>
          )}
        </>
      )}
    </div>
  )
}
