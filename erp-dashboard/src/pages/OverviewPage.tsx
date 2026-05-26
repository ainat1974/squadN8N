import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { periodDays, periodLabel } from '../utils/period'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#747474', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.06)' } },
    y: { ticks: { color: '#747474', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.06)' } },
  },
}

export default function OverviewPage() {
  const { period } = usePeriod()
  const diasPeriodo = periodDays(period)
  const requestOptions = { periodo: period, dias: diasPeriodo }

  const resumo = useErpData(() => api.resumo(requestOptions), [period])
  const vendas = useErpData(() => api.vendas(requestOptions), [period])
  const estoque = useErpData(() => api.estoque(requestOptions), [period])
  const contasReceber = useErpData(() => api.contasReceber(requestOptions), [period])
  const fluxoCaixa = useErpData(() => api.fluxoCaixa(requestOptions), [period])

  const r = resumo.data as any
  const vendasData = (vendas.data as any)?.dados
  const estoqueData = (estoque.data as any)?.dados
  const crData = (contasReceber.data as any)?.dados
  const fluxoData = (fluxoCaixa.data as any)?.dados

  const evolucao: any[] = vendasData?.evolucao_diaria || []
  const chartLabels = evolucao.map(item => formatDate(item.data))
  const chartValues = evolucao.map(item => Number(item.receita || 0))
  const fluxo = fluxoData?.projecao_4_semanas || []
  const saldoDia: any[] = estoqueData?.saldo_dia || []
  const baixoEstoque = saldoDia
    .filter(item => Number(item.estoque_atual || 0) > 0)
    .sort((a, b) => Number(a.estoque_atual || 0) - Number(b.estoque_atual || 0))
    .slice(0, 5)
  const recebendo7d: any[] = crData?.recebendo_7d?.slice(0, 5) || []

  const partialErrors = [resumo.error, vendas.error, estoque.error, contasReceber.error, fluxoCaixa.error].filter(Boolean)
  const loading = resumo.loading || vendas.loading

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="ERP Dapic / Command Center"
        title="Visao Geral Executiva"
        description="Demonstracao consolidada dos dados coletados no D-1. Vendas podem ser agregadas por periodo; estoque e financeiro representam o snapshot da ultima coleta diaria."
        meta={
          <>
            <StatusPill tone="orange">{periodLabel(period)}</StatusPill>
            {r?.data && <StatusPill tone="muted">Base {formatDate(r.data)}</StatusPill>}
            {partialErrors.length > 0 && <StatusPill tone="red">{partialErrors.length} alerta(s)</StatusPill>}
          </>
        }
      />

      {partialErrors.length > 0 && (
        <Panel title="Alertas de dados" subtitle="Alguns modulos retornaram erro ou ainda nao foram coletados." className="mb-4">
          <div className="p-4 text-sm text-[var(--text-secondary)]">
            {partialErrors.map((error, index) => <p key={index} className="m-0 py-1">{error}</p>)}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita no periodo"
          value={loading ? '...' : formatBRL(r?.receita_total || 0)}
          detail={`${formatNum(r?.volume_vendas || 0)} vendas coletadas`}
          tone="orange"
        />
        <MetricCard
          label="Ticket medio"
          value={loading ? '...' : formatBRL(r?.ticket_medio || 0)}
          detail={`PDV ${formatBRL(r?.receita_pdv || 0)}`}
          tone="green"
        />
        <MetricCard
          label="Estoque monitorado"
          value={estoque.loading ? '...' : formatNum(estoqueData?.summary?.total_skus || saldoDia.length || 0)}
          detail={`${formatNum(r?.skus_criticos || 0)} criticos / ${formatNum(r?.skus_alerta || 0)} alerta`}
          tone="blue"
        />
        <MetricCard
          label="Saldo CR - CP"
          value={resumo.loading ? '...' : formatBRL(r?.saldo_liquido || 0)}
          detail={r?.data ? `Snapshot ${formatDate(r.data)}` : 'Aguardando coleta'}
          tone={(r?.saldo_liquido || 0) >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Evolucao de receita" subtitle={`Serie agregada: ${periodLabel(period)}`}>
          <div className="h-72 p-4">
            {vendas.loading ? <LoadingBlock height="h-full" /> : evolucao.length > 0 ? (
              <Line
                data={{
                  labels: chartLabels,
                  datasets: [{
                    data: chartValues,
                    borderColor: '#ff7a2f',
                    backgroundColor: 'rgba(255, 122, 47, 0.14)',
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#ff7a2f',
                    pointRadius: 4,
                  }],
                }}
                options={chartBase as any}
              />
            ) : <EmptyState title="Sem serie de vendas" detail="O historico D-1 sera acumulado a cada execucao diaria." />}
          </div>
        </Panel>

        <Panel title="Fluxo financeiro" subtitle="Resultado dos registros financeiros coletados">
          <div className="h-72 p-4">
            {fluxoCaixa.loading ? <LoadingBlock height="h-full" /> : fluxo.length > 0 ? (
              <Bar
                data={{
                  labels: fluxo.map((item: any) => item.semana),
                  datasets: [
                    { label: 'Entradas', data: fluxo.map((item: any) => item.entradas_previstas), backgroundColor: '#42d392', borderRadius: 4 },
                    { label: 'Saidas', data: fluxo.map((item: any) => item.saidas_previstas), backgroundColor: '#ff5f57', borderRadius: 4 },
                  ],
                }}
                options={{ ...chartBase, plugins: { legend: { labels: { color: '#b7b7b7' } } } } as any}
              />
            ) : <EmptyState title="Sem movimentacao financeira no D-1" detail="A coleta funcionou, mas nao retornou parcelas financeiras para demonstrar fluxo." />}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Estoque em atencao" subtitle="Menores saldos do snapshot D-1">
          <div className="p-4">
            {estoque.loading ? <LoadingBlock /> : baixoEstoque.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Produto</th><th className="text-right">Saldo</th></tr></thead>
                <tbody>
                  {baixoEstoque.map((item, index) => (
                    <tr key={`${item.codigo}-${index}`}>
                      <td className="max-w-[320px] truncate">{item.produto}</td>
                      <td className="text-right font-bold text-[var(--accent)]">{formatNum(item.estoque_atual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem estoque para listar" detail="O modulo de estoque ainda nao retornou saldos demonstraveis." />}
          </div>
        </Panel>

        <Panel title="Recebimentos proximos" subtitle="CR retornado na ultima coleta">
          <div className="p-4">
            {contasReceber.loading ? <LoadingBlock /> : recebendo7d.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Cliente</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {recebendo7d.map((item, index) => (
                    <tr key={`${item.id}-${index}`}>
                      <td className="max-w-[320px] truncate">{item.cliente || 'Cliente nao informado'}</td>
                      <td className="text-right font-bold text-[var(--success)]">{formatBRL(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem recebimentos no D-1" detail="Isso indica ausencia de registros financeiros retornados para a data coletada, nao falha visual." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}

