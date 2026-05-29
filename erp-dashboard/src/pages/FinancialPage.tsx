import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate } from '../services/api'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function FinancialPage() {
  const cp = useErpData(api.contasPagar)
  const cr = useErpData(api.contasReceber)
  const fc = useErpData(api.fluxoCaixa)

  const cpData = (cp.data as any)?.dados
  const crData = (cr.data as any)?.dados
  const fcData = (fc.data as any)?.dados
  const periodoMeta = (fc.data as any) || (cr.data as any) || (cp.data as any)
  const periodoLabel = periodoMeta?.dataInicial && periodoMeta?.dataFinal
    ? `${formatDate(periodoMeta.dataInicial)} a ${formatDate(periodoMeta.dataFinal)}`
    : null
  const projecao: any[] = fcData?.projecao_4_semanas || []
  const fluxoResumo = fcData?.summary || {}
  const mediaSemanal = Number(fluxoResumo.media_semanal_entradas || 0)
  const usaMediaMovel = (fcData?.metodo_projecao || '') === 'media_movel_entradas_realizadas'
  const projecaoSubtitle = usaMediaMovel
    ? `Estimativa por media movel das entradas realizadas${mediaSemanal > 0 ? ` (~${formatBRL(mediaSemanal)}/semana)` : ''}`
    : 'Entradas, saidas e saldo'
  const fluxoResumoValores = [
    Number(fluxoResumo.pagamentos_realizados || 0),
    Number(fluxoResumo.aberto_previsto || 0),
  ]
  const temFluxoResumo = fluxoResumoValores.some(value => value > 0)
  const errors = [cp.error, cr.error, fc.error].filter(Boolean)
  const loading = cp.loading || cr.loading || fc.loading

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="Financeiro"
        title="Contas e fluxo"
        description="Caixa recebido e recebiveis com vencimento no intervalo selecionado. O atraso/inadimplencia e medido em relacao a hoje. Listas vazias indicam ausencia de parcelas no periodo, nao erro visual."
        meta={
          <>
            {periodoLabel && <StatusPill tone="orange">{periodoLabel}</StatusPill>}
            {errors.length > 0 && <StatusPill tone="red">{errors.length} erro(s)</StatusPill>}
          </>
        }
      />

      {errors.length > 0 && (
        <Panel title="Alertas financeiros" subtitle="Falhas retornadas pelos modulos de CP, CR ou fluxo." className="mb-4">
          <div className="p-4 text-sm text-[var(--text-secondary)]">
            {errors.map((error, index) => <p key={index} className="m-0 py-1">{error}</p>)}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="CP pendente" value={cp.loading ? '...' : formatBRL(cpData?.summary?.total_pendente || 0)} detail="contas a pagar" tone="orange" />
        <MetricCard label="CP vencido" value={cp.loading ? '...' : formatBRL(cpData?.summary?.total_vencido || 0)} detail="retorno D-1" tone="red" />
        <MetricCard label="CR pendente" value={cr.loading ? '...' : formatBRL(crData?.summary?.total_pendente || 0)} detail="contas a receber" tone="blue" />
        <MetricCard label="Saldo liquido" value={cr.loading ? '...' : formatBRL(crData?.summary?.saldo_liquido || 0)} detail="CR - CP" tone={(crData?.summary?.saldo_liquido || 0) >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Fluxo projetado" subtitle={temFluxoResumo ? 'Pagamentos realizados e parcelas abertas' : 'Gerado quando existem vencimentos retornados'}>
          <div className="h-72 p-4">
            {loading ? <LoadingBlock height="h-full" /> : temFluxoResumo ? (
              <Bar
                data={{
                  labels: ['Pagamentos D-1', 'Parcelas abertas'],
                  datasets: [{
                    label: 'Valor',
                    data: fluxoResumoValores,
                    backgroundColor: ['#42d392', '#ff5f57'],
                    borderColor: ['#42d392', '#ff5f57'],
                    borderWidth: 1,
                    borderRadius: 5,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#747474' }, grid: { color: 'rgba(255,255,255,.06)' } },
                    y: { ticks: { color: '#747474' }, grid: { color: 'rgba(255,255,255,.06)' } },
                  },
                }}
              />
            ) : projecao.length > 0 ? (
              <Bar
                data={{
                  labels: projecao.map(item => item.semana),
                  datasets: [
                    { label: 'Entradas', data: projecao.map(item => item.entradas_previstas), backgroundColor: '#42d392', borderRadius: 5 },
                    { label: 'Saidas', data: projecao.map(item => item.saidas_previstas), backgroundColor: '#ff5f57', borderRadius: 5 },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#b7b7b7' } } },
                  scales: {
                    x: { ticks: { color: '#747474' }, grid: { color: 'rgba(255,255,255,.06)' } },
                    y: { ticks: { color: '#747474' }, grid: { color: 'rgba(255,255,255,.06)' } },
                  },
                }}
              />
            ) : <EmptyState title="Sem fluxo para projetar" detail="A coleta D-1 nao retornou vencimentos financeiros suficientes para formar a serie." />}
          </div>
        </Panel>

        <Panel title="Resumo por semana" subtitle={projecaoSubtitle}>
          <div className="overflow-x-auto p-4">
            {loading ? <LoadingBlock /> : projecao.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Semana</th><th className="text-right">Entradas</th><th className="text-right">Saidas</th><th className="text-right">Saldo</th></tr></thead>
                <tbody>
                  {projecao.map((item, index) => (
                    <tr key={`${item.semana}-${index}`}>
                      <td>{item.semana}</td>
                      <td className="text-right text-[var(--success)]">{formatBRL(item.entradas_previstas || 0)}</td>
                      <td className="text-right text-[var(--danger)]">{formatBRL(item.saidas_previstas || 0)}</td>
                      <td className="text-right font-bold">{formatBRL(item.saldo_semana || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem semanas calculadas" detail="Painel pronto para aparecer quando houver parcelas retornadas." />}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="CP vencidos" subtitle="Contas a pagar retornadas como vencidas">
          <FinancialList
            loading={loading}
            items={cpData?.vencidos || []}
            emptyTitle="Sem CP vencido no D-1"
            getName={(item) => item.descricao || 'Fornecedor nao informado'}
            getDetail={(item) => `${item.dias_atraso || 0}d atraso`}
          />
        </Panel>

        <Panel title="CR inadimplentes" subtitle="Contas a receber retornadas em atraso">
          <FinancialList
            loading={loading}
            items={crData?.inadimplentes || []}
            emptyTitle="Sem CR inadimplente no D-1"
            getName={(item) => item.cliente || 'Cliente nao informado'}
            getDetail={(item) => item.data_vencimento ? `Venc. ${formatDate(item.data_vencimento)}` : 'Sem vencimento'}
          />
        </Panel>
      </div>
    </div>
  )
}

function FinancialList({
  loading,
  items,
  emptyTitle,
  getName,
  getDetail,
}: {
  loading: boolean
  items: any[]
  emptyTitle: string
  getName: (item: any) => string
  getDetail: (item: any) => string
}) {
  return (
    <div className="overflow-x-auto p-4">
      {loading ? <LoadingBlock /> : items.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Registro</th><th>Detalhe</th><th className="text-right">Valor</th></tr></thead>
          <tbody>
            {items.slice(0, 10).map((item, index) => (
              <tr key={`${item.id}-${index}`}>
                <td className="max-w-[300px] truncate">{getName(item)}</td>
                <td>{getDetail(item)}</td>
                <td className="text-right font-bold text-[var(--accent)]">{formatBRL(item.valor || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <EmptyState title={emptyTitle} detail="A tela diferencia ausencia de registro de erro de coleta." />}
    </div>
  )
}
