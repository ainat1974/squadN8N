import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { useTriggerColeta } from '../hooks/useTriggerColeta'
import { api, formatBRL, formatDate } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { buildApiOptions } from '../utils/period'
import DateRangePicker from '../components/DateRangePicker'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// =====================================================================
// PREVIEW: mock realista da página Financeiro até o workflow N8N
// dedicado de Financeiro entrar. Desligar a flag quando ativar.
// =====================================================================
const PREVIEW_FINANCEIRO = true

function gerarFinanceiroMock() {
  let seed = 23
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const fornecedores = [
    'FORNECEDOR TECIDOS SP LTDA', 'CONFECCAO ZHEN', 'MALHARIA ITAJUBA',
    'EMBALAGENS PREMIUM', 'TRANSPORTADORA RAPIDA', 'ETIQUETAS PRINT EXPRESS',
    'CIA ENERGETICA DE SP', 'IMOBILIARIA CENTRO', 'CONTABILIDADE FIRME',
    'TI SOLUTIONS LTDA', 'AGUA E SANEAMENTO', 'MARKETING DIGITAL PRO',
    'BANCO ITAU - PARCELA', 'CARTAO BNDES PARCELA', 'FIBRA NET TELECOM',
    'MANUTENCAO MAQUINAS LTDA', 'TINTAS E ACABAMENTOS', 'AVIAMENTOS POPULAR',
  ]
  const clientes = [
    'VINICIUS TAKAGI REIS', 'DENIS COSTA', 'ANTONIO RENATO BETTANIN LTDA',
    'JOAO VITOR BISCO DE SOUZA', 'ANA PAULA PIAI', 'FRANCIMARA VALERIA PEREIRA',
    'BR MOLETON LTDA', 'CAIO RHEDA GARCIA', 'LUBRI10 COMERCIO DE PECAS',
    'CLAUDIA MARIA SILVA', 'ROBERTO CARLOS FERREIRA', 'JULIA MARTINS COSTA',
    'PEDRO HENRIQUE OLIVEIRA', 'LARISSA DE SOUZA ANDRADE', 'TIAGO BORGES',
    'CAMILA FREITAS', 'MARCELO SANTOS LTDA - ME', 'BEATRIZ NOGUEIRA',
    'RAFAEL ALVES PEREIRA', 'PATRICIA OLIVEIRA LIMA',
  ]

  const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }

  const cpVencidos: any[] = []
  for (let i = 0; i < 18; i++) {
    const dias = -Math.round(rng() * 75 + 1)
    const valor = Math.round((rng() * 8000 + 400) * 100) / 100
    cpVencidos.push({
      id: `cpv-${i}`,
      descricao: fornecedores[i % fornecedores.length],
      data_vencimento: addDias(hoje, dias),
      dias_atraso: -dias,
      valor,
    })
  }
  cpVencidos.sort((a, b) => b.valor - a.valor)

  const cpVencendo7d: any[] = []
  for (let i = 0; i < 12; i++) {
    const dias = Math.round(rng() * 7)
    cpVencendo7d.push({
      id: `cpv7-${i}`,
      descricao: fornecedores[(i + 6) % fornecedores.length],
      data_vencimento: addDias(hoje, dias),
      dias_para_vencer: dias,
      valor: Math.round((rng() * 5000 + 200) * 100) / 100,
    })
  }
  cpVencendo7d.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)

  const crInadimplentes: any[] = []
  for (let i = 0; i < 20; i++) {
    const dias = -Math.round(rng() * 90 + 1)
    crInadimplentes.push({
      id: `cri-${i}`,
      cliente: clientes[i % clientes.length],
      data_vencimento: addDias(hoje, dias),
      dias_atraso: -dias,
      valor: Math.round((rng() * 6000 + 300) * 100) / 100,
    })
  }
  crInadimplentes.sort((a, b) => b.valor - a.valor)

  const crRecebendo7d: any[] = []
  for (let i = 0; i < 15; i++) {
    const dias = Math.round(rng() * 7)
    crRecebendo7d.push({
      id: `crr7-${i}`,
      cliente: clientes[(i + 5) % clientes.length],
      data_vencimento: addDias(hoje, dias),
      dias_para_vencer: dias,
      valor: Math.round((rng() * 4500 + 250) * 100) / 100,
    })
  }
  crRecebendo7d.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)

  const somaCpV = cpVencidos.reduce((s, x) => s + x.valor, 0)
  const somaCpP = cpVencendo7d.reduce((s, x) => s + x.valor, 0) + somaCpV * 0.85
  const somaCrV = crInadimplentes.reduce((s, x) => s + x.valor, 0)
  const somaCrP = crRecebendo7d.reduce((s, x) => s + x.valor, 0) + somaCrV * 0.92

  const projecao_4_semanas = [
    { semana: 'S1 (atual)', entradas_previstas: 28500, saidas_previstas: 22300, saldo_semana: 6200 },
    { semana: 'S2', entradas_previstas: 31200, saidas_previstas: 24800, saldo_semana: 6400 },
    { semana: 'S3', entradas_previstas: 27800, saidas_previstas: 26500, saldo_semana: 1300 },
    { semana: 'S4', entradas_previstas: 34100, saidas_previstas: 23200, saldo_semana: 10900 },
  ]

  return {
    contasPagar: {
      summary: {
        total_pendente: Math.round(somaCpP * 100) / 100,
        total_vencido: Math.round(somaCpV * 100) / 100,
        total_pago: 41280.55,
        total_vencendo_7d: cpVencendo7d.reduce((s, x) => s + x.valor, 0),
      },
      vencidos: cpVencidos,
      vencendo_7d: cpVencendo7d,
    },
    contasReceber: {
      summary: {
        total_pendente: Math.round(somaCrP * 100) / 100,
        total_inadimplente: Math.round(somaCrV * 100) / 100,
        total_recebendo_7d: crRecebendo7d.reduce((s, x) => s + x.valor, 0),
        saldo_liquido: Math.round((somaCrP - somaCpP) * 100) / 100,
      },
      inadimplentes: crInadimplentes,
      recebendo_7d: crRecebendo7d,
    },
    fluxoCaixa: {
      metodo_projecao: 'media_movel_entradas_realizadas',
      summary: {
        pagamentos_realizados: 41280.55,
        aberto_previsto: Math.round(somaCpP * 100) / 100,
        saldo: Math.round((41280.55 - somaCpP) * 100) / 100,
        media_diaria_entradas: 4071,
        media_semanal_entradas: 28500,
        projecao_4_semanas_total: 121600,
      },
      projecao_4_semanas,
    },
  }
}

const FINANCEIRO_MOCK = gerarFinanceiroMock()
// =====================================================================

function abbreviateNumber(value: number): string {
  if (value == null || Number.isNaN(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',') + 'M'
  if (abs >= 1_000) return (value / 1_000).toFixed(1).replace('.0', '').replace('.', ',') + 'k'
  return String(Math.round(value))
}

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

// Aging buckets: 1-7, 8-30, 31-60, 60+
function calcAging(items: any[]) {
  const buckets = { b1: 0, b2: 0, b3: 0, b4: 0 }
  for (const item of items) {
    const dias = Number(item.dias_atraso || 0)
    const valor = Number(item.valor || 0)
    if (dias <= 7) buckets.b1 += valor
    else if (dias <= 30) buckets.b2 += valor
    else if (dias <= 60) buckets.b3 += valor
    else buckets.b4 += valor
  }
  return buckets
}

export default function FinancialPage() {
  const { range } = usePeriod()
  const trigger = useTriggerColeta()
  const fetchOptions = buildApiOptions(range)
  const rangeKey = `${range.dataInicial}|${range.dataFinal}`
  const cp = useErpData(() => api.contasPagar(fetchOptions), [rangeKey])
  const cr = useErpData(() => api.contasReceber(fetchOptions), [rangeKey])
  const fc = useErpData(() => api.fluxoCaixa(fetchOptions), [rangeKey])

  const [filtros, setFiltros] = useState({
    cpVencidos: '',
    cpVencendo: '',
    crInadimplentes: '',
    crProximos: '',
  })

  const cpReal = (cp.data as any)?.dados
  const crReal = (cr.data as any)?.dados
  const fcReal = (fc.data as any)?.dados

  const cpData = PREVIEW_FINANCEIRO ? FINANCEIRO_MOCK.contasPagar : cpReal
  const crData = PREVIEW_FINANCEIRO ? FINANCEIRO_MOCK.contasReceber : crReal
  const fcData = PREVIEW_FINANCEIRO ? FINANCEIRO_MOCK.fluxoCaixa : fcReal

  const periodoMeta = !PREVIEW_FINANCEIRO ? ((fc.data as any) || (cr.data as any) || (cp.data as any)) : null
  const periodoLabel = periodoMeta?.dataInicial && periodoMeta?.dataFinal
    ? `${formatDate(periodoMeta.dataInicial)} a ${formatDate(periodoMeta.dataFinal)}`
    : `${formatDate(range.dataInicial)} a ${formatDate(range.dataFinal)}`

  const projecao: any[] = fcData?.projecao_4_semanas || []
  const fluxoResumo = fcData?.summary || {}
  const mediaSemanal = Number(fluxoResumo.media_semanal_entradas || 0)
  const usaMediaMovel = (fcData?.metodo_projecao || '') === 'media_movel_entradas_realizadas'
  const projecaoSubtitle = usaMediaMovel
    ? `Estimativa por média móvel das entradas realizadas${mediaSemanal > 0 ? ` (~${formatBRL(mediaSemanal)}/semana)` : ''}`
    : 'Entradas, saídas e saldo'

  const errors = !PREVIEW_FINANCEIRO ? [cp.error, cr.error, fc.error].filter(Boolean) : []
  const loading = !PREVIEW_FINANCEIRO && (cp.loading || cr.loading || fc.loading)

  // Listas (com fallback para arrays vazios). Memoizadas para estabilizar referencia
  // entre re-renders e evitar warning de exhaustive-deps nos useMemo abaixo.
  const cpVencidos = useMemo<any[]>(() => cpData?.vencidos || [], [cpData])
  const cpVencendo = useMemo<any[]>(() => cpData?.vencendo_7d || [], [cpData])
  const crInadimplentes = useMemo<any[]>(() => crData?.inadimplentes || [], [crData])
  const crProximos = useMemo<any[]>(() => crData?.recebendo_7d || [], [crData])

  // Aging
  const cpAging = useMemo(() => calcAging(cpVencidos), [cpVencidos])
  const crAging = useMemo(() => calcAging(crInadimplentes), [crInadimplentes])

  // Filtros aplicados
  const cpVencidosFiltrados = useMemo(() => {
    const q = filtros.cpVencidos.trim().toLowerCase()
    return q ? cpVencidos.filter(i => String(i.descricao || '').toLowerCase().includes(q)) : cpVencidos
  }, [cpVencidos, filtros.cpVencidos])
  const cpVencendoFiltrados = useMemo(() => {
    const q = filtros.cpVencendo.trim().toLowerCase()
    return q ? cpVencendo.filter(i => String(i.descricao || '').toLowerCase().includes(q)) : cpVencendo
  }, [cpVencendo, filtros.cpVencendo])
  const crInadFiltrados = useMemo(() => {
    const q = filtros.crInadimplentes.trim().toLowerCase()
    return q ? crInadimplentes.filter(i => String(i.cliente || '').toLowerCase().includes(q)) : crInadimplentes
  }, [crInadimplentes, filtros.crInadimplentes])
  const crProxFiltrados = useMemo(() => {
    const q = filtros.crProximos.trim().toLowerCase()
    return q ? crProximos.filter(i => String(i.cliente || '').toLowerCase().includes(q)) : crProximos
  }, [crProximos, filtros.crProximos])

  return (
    <div>
      <PageHeader
        eyebrow="Financeiro"
        title="Contas e fluxo"
        description="Caixa recebido e recebíveis no intervalo selecionado. O atraso/inadimplência é medido em relação a HOJE (independente do intervalo). Listas vazias indicam ausência de parcelas no período — não erro."
        meta={
          <>
            <StatusPill tone="orange">{periodoLabel}</StatusPill>
            {errors.length > 0 && <StatusPill tone="red">{errors.length} erro(s)</StatusPill>}
          </>
        }
      />

      <div className="mb-4">
        <DateRangePicker
          hidePresets
          showAtualizar
          onAtualizar={() => trigger.run()}
          atualizando={trigger.isBusy}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PREVIEW_FINANCEIRO && (
          <StatusPill tone="orange">PREVIEW — dados simulados para visualização</StatusPill>
        )}
        {trigger.isBusy && <StatusPill tone="blue">Atualizando…</StatusPill>}
        {trigger.state === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {trigger.state === 'timeout' && <StatusPill tone="red">Tempo esgotado</StatusPill>}
        {trigger.state === 'error' && <StatusPill tone="red">Falha ao iniciar coleta</StatusPill>}
      </div>

      {errors.length > 0 && (
        <Panel title="Alertas financeiros" subtitle="Falhas retornadas pelos módulos de CP, CR ou fluxo." className="mb-4">
          <div className="p-4 text-sm text-[var(--text-secondary)]">
            {errors.map((error, index) => <p key={index} className="m-0 py-1">{String(error)}</p>)}
          </div>
        </Panel>
      )}

      {/* 1. KPI strip principal */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard compact label="CP pendente" value={loading ? '...' : formatBRL(cpData?.summary?.total_pendente || 0)} detail="contas a pagar em aberto" tone="orange" />
        <MetricCard compact label="CP vencido" value={loading ? '...' : formatBRL(cpData?.summary?.total_vencido || 0)} detail={`${cpVencidos.length} parcela(s) em atraso`} tone="red" />
        <MetricCard compact label="CR pendente" value={loading ? '...' : formatBRL(crData?.summary?.total_pendente || 0)} detail="contas a receber em aberto" tone="blue" />
        <MetricCard
          compact
          label="Saldo líquido"
          value={loading ? '...' : formatBRL(crData?.summary?.saldo_liquido || 0)}
          detail="CR pendente − CP pendente"
          tone={(crData?.summary?.saldo_liquido || 0) >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* 2. KPI strip operacional */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard compact label="Caixa entrou no período" value={loading ? '...' : formatBRL(fluxoResumo.pagamentos_realizados || 0)} detail="pagamentos efetivamente realizados" tone="green" />
        <MetricCard compact label="Próx. 7 dias — a pagar" value={loading ? '...' : formatBRL(cpData?.summary?.total_vencendo_7d || 0)} detail={`${cpVencendo.length} parcela(s) a vencer`} tone="orange" />
        <MetricCard compact label="Próx. 7 dias — a receber" value={loading ? '...' : formatBRL(crData?.summary?.total_recebendo_7d || 0)} detail={`${crProximos.length} parcela(s) a receber`} tone="green" />
        <MetricCard compact label="Saldo do caixa" value={loading ? '...' : formatBRL(fluxoResumo.saldo || 0)} detail="pagamentos realizados − aberto previsto" tone={(fluxoResumo.saldo || 0) >= 0 ? 'green' : 'red'} />
      </div>

      {/* 3. Aging dos vencidos (CP e CR) */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Aging — CP vencidos" subtitle="Distribuição do que está em atraso a pagar">
          <AgingStrip data={cpAging} total={cpData?.summary?.total_vencido || 0} />
        </Panel>
        <Panel title="Aging — CR inadimplentes" subtitle="Distribuição do que está em atraso a receber">
          <AgingStrip data={crAging} total={crData?.summary?.total_inadimplente || 0} />
        </Panel>
      </div>

      {/* 4. Projeção de fluxo (sempre exibida) */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Projeção de 4 semanas" subtitle={projecaoSubtitle}>
          <div className="h-72 p-4">
            {loading ? <LoadingBlock height="h-full" /> : projecao.length > 0 ? (
              <Bar
                data={{
                  labels: projecao.map(item => item.semana),
                  datasets: [
                    { label: 'Entradas', data: projecao.map(item => Number(item.entradas_previstas || 0)), backgroundColor: '#42d392', borderRadius: 4 },
                    { label: 'Saídas', data: projecao.map(item => Number(item.saidas_previstas || 0)), backgroundColor: '#ff5f57', borderRadius: 4 },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  layout: { padding: { top: 22 } },
                  plugins: {
                    legend: { labels: { color: '#b7b7b7', font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${formatBRL(Number(ctx.parsed.y || 0))}` } },
                  },
                  scales: {
                    x: { ticks: { color: '#a8a8a8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.05)' } },
                    y: { ticks: { color: '#747474', font: { size: 11 }, callback: (v: any) => abbreviateNumber(Number(v)) }, grid: { color: 'rgba(255,255,255,.06)' } },
                  },
                }}
                plugins={[valueOnBarsPlugin]}
              />
            ) : <EmptyState title="Sem fluxo para projetar" detail="Coleta não retornou parcelas suficientes para projetar 4 semanas." />}
          </div>
        </Panel>

        <Panel title="Resumo por semana" subtitle="Entradas, saídas e saldo semanal">
          <div className="overflow-x-auto p-4">
            {loading ? <LoadingBlock /> : projecao.length > 0 ? (
              <table className="data-table min-w-full">
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th className="text-right whitespace-nowrap">Entradas</th>
                    <th className="text-right whitespace-nowrap">Saídas</th>
                    <th className="text-right whitespace-nowrap">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {projecao.map((item, index) => {
                    const saldo = Number(item.saldo_semana || 0)
                    return (
                      <tr key={`${item.semana}-${index}`}>
                        <td className="whitespace-nowrap">{item.semana}</td>
                        <td className="text-right text-[var(--success)] whitespace-nowrap">{formatBRL(Number(item.entradas_previstas || 0))}</td>
                        <td className="text-right text-[var(--danger)] whitespace-nowrap">{formatBRL(Number(item.saidas_previstas || 0))}</td>
                        <td className={`text-right font-bold whitespace-nowrap ${saldo >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{formatBRL(saldo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : <EmptyState title="Sem semanas calculadas" detail="Painel pronto para aparecer quando houver parcelas retornadas." />}
          </div>
        </Panel>
      </div>

      {/* 5. CP — vencidos + a vencer 7d */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={`CP vencidos (${cpVencidosFiltrados.length})`} subtitle="Contas a pagar em atraso · maiores primeiro">
          <FinancialList
            loading={loading}
            items={cpVencidosFiltrados}
            emptyTitle="Sem CP vencido no período"
            filtro={filtros.cpVencidos}
            setFiltro={(v) => setFiltros(f => ({ ...f, cpVencidos: v }))}
            getName={(item) => item.descricao || 'Fornecedor não informado'}
            getDetail={(item) => `${item.dias_atraso || 0}d atraso · venc. ${item.data_vencimento ? formatDate(item.data_vencimento) : '—'}`}
          />
        </Panel>

        <Panel title={`A pagar — próximos 7 dias (${cpVencendoFiltrados.length})`} subtitle="Parcelas a vencer · mais urgentes primeiro">
          <FinancialList
            loading={loading}
            items={cpVencendoFiltrados}
            emptyTitle="Nenhuma CP nos próximos 7 dias"
            filtro={filtros.cpVencendo}
            setFiltro={(v) => setFiltros(f => ({ ...f, cpVencendo: v }))}
            getName={(item) => item.descricao || 'Fornecedor não informado'}
            getDetail={(item) => {
              const dias = item.dias_para_vencer ?? 0
              const label = dias === 0 ? 'Hoje' : `Em ${dias}d`
              return `${label} · venc. ${item.data_vencimento ? formatDate(item.data_vencimento) : '—'}`
            }}
            highlightTone="orange"
          />
        </Panel>
      </div>

      {/* 6. CR — inadimplentes + a receber 7d */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={`CR inadimplentes (${crInadFiltrados.length})`} subtitle="Recebíveis em atraso · maiores primeiro">
          <FinancialList
            loading={loading}
            items={crInadFiltrados}
            emptyTitle="Sem CR inadimplente no período"
            filtro={filtros.crInadimplentes}
            setFiltro={(v) => setFiltros(f => ({ ...f, crInadimplentes: v }))}
            getName={(item) => item.cliente || 'Cliente não informado'}
            getDetail={(item) => `${item.dias_atraso || 0}d atraso · venc. ${item.data_vencimento ? formatDate(item.data_vencimento) : '—'}`}
            highlightTone="red"
          />
        </Panel>

        <Panel title={`A receber — próximos 7 dias (${crProxFiltrados.length})`} subtitle="Recebíveis a vencer · mais urgentes primeiro">
          <FinancialList
            loading={loading}
            items={crProxFiltrados}
            emptyTitle="Nenhum recebível nos próximos 7 dias"
            filtro={filtros.crProximos}
            setFiltro={(v) => setFiltros(f => ({ ...f, crProximos: v }))}
            getName={(item) => item.cliente || 'Cliente não informado'}
            getDetail={(item) => {
              const dias = item.dias_para_vencer ?? 0
              const label = dias === 0 ? 'Hoje' : `Em ${dias}d`
              return `${label} · venc. ${item.data_vencimento ? formatDate(item.data_vencimento) : '—'}`
            }}
            highlightTone="green"
          />
        </Panel>
      </div>
    </div>
  )
}

function AgingStrip({ data, total }: { data: { b1: number; b2: number; b3: number; b4: number }; total: number }) {
  const safeTotal = total > 0 ? total : (data.b1 + data.b2 + data.b3 + data.b4) || 1
  const pct = (n: number) => Math.round((n / safeTotal) * 100)
  const buckets = [
    { label: '1–7 dias', value: data.b1, tone: 'orange', color: 'bg-[var(--accent)]' },
    { label: '8–30 dias', value: data.b2, tone: 'orange', color: 'bg-[var(--accent-strong)]' },
    { label: '31–60 dias', value: data.b3, tone: 'red', color: 'bg-[var(--danger)]/70' },
    { label: '+60 dias', value: data.b4, tone: 'red', color: 'bg-[var(--danger)]' },
  ] as const

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buckets.map(b => (
          <div key={b.label} className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
            <div className="break-words text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">{b.label}</div>
            <div className="mt-1 break-words text-sm font-extrabold tabular-nums text-[var(--text-primary)] sm:text-base">
              {formatBRL(b.value)}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]/40">
              <div className={`h-full ${b.color}`} style={{ width: `${pct(b.value)}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">{pct(b.value)}% do total</div>
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 break-words text-[11px] text-[var(--text-muted)]">
        Total em atraso: <b className="tabular-nums text-[var(--text-primary)]">{formatBRL(total)}</b>
      </p>
    </div>
  )
}

function FinancialList({
  loading,
  items,
  emptyTitle,
  filtro,
  setFiltro,
  getName,
  getDetail,
  highlightTone = 'red',
}: {
  loading: boolean
  items: any[]
  emptyTitle: string
  filtro?: string
  setFiltro?: (value: string) => void
  getName: (item: any) => string
  getDetail: (item: any) => string
  highlightTone?: 'red' | 'orange' | 'green'
}) {
  const accentClass =
    highlightTone === 'green' ? 'text-[var(--success)]' :
    highlightTone === 'orange' ? 'text-[var(--accent)]' :
    'text-[var(--danger)]'
  const total = items.reduce((s, i) => s + Number(i.valor || 0), 0)

  return (
    <div className="p-3 sm:p-4">
      {setFiltro && (
        <input
          className="search-input mb-3"
          placeholder="Filtrar por nome…"
          value={filtro || ''}
          onChange={e => setFiltro(e.target.value)}
        />
      )}
      <div className="max-h-[24rem] overflow-auto pr-1">
        {loading ? <LoadingBlock /> : items.length > 0 ? (
          <table className="data-table min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--bg-panel)]">
                <th>Registro</th>
                <th>Detalhe</th>
                <th className="text-right whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((item, index) => (
                <tr key={`${item.id}-${index}`}>
                  <td className="break-words">{getName(item)}</td>
                  <td className="break-words text-[var(--text-secondary)]">{getDetail(item)}</td>
                  <td className={`text-right font-bold whitespace-nowrap ${accentClass}`}>{formatBRL(Number(item.valor || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title={emptyTitle} detail="A tela diferencia ausência de registro de erro de coleta." />}
      </div>
      {items.length > 0 && (
        <p className="m-0 mt-2 text-[11px] text-[var(--text-muted)]">
          Mostrando até 30 de {items.length} · Total exibido: <b className="text-[var(--text-primary)]">{formatBRL(total)}</b>
        </p>
      )}
    </div>
  )
}
