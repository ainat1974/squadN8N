import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { periodDays, periodLabel } from '../utils/period'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function SalesPage() {
  const { period } = usePeriod()
  const diasPeriodo = periodDays(period)
  const labelPeriodo = periodLabel(period)
  const { data, loading, error, refresh } = useErpData(
    () => api.vendas({ periodo: period, dias: diasPeriodo }),
    [period],
  )

  const response = data as any
  const d = response?.dados
  const summary = d?.summary || {}
  const evolucao: any[] = d?.evolucao_diaria || []
  const produtosVendidos: any[] = d?.produtos_vendidos || d?.top_produtos || []
  const topProdutos: any[] = [...produtosVendidos]
    .map(item => ({
      ...item,
      quantidade: Number(item.quantidade || 0),
      valor_total: Number(item.valor_total ?? item.receita ?? 0),
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10)
  const topClientes: any[] = d?.top_clientes?.slice(0, 6) || []
  const periodo = d?.periodo
  const doughnutData = {
    labels: ['PDV', 'B2B'],
    datasets: [{
      data: [summary.receita_pdv || 0, summary.receita_b2b || 0],
      backgroundColor: ['#ff7a2f', '#42d392'],
      borderColor: '#111111',
      borderWidth: 2,
    }],
  }

  if (error) {
    return (
      <Panel title="Vendas indisponiveis" subtitle="O N8N retornou erro para este modulo.">
        <div className="p-6">
          <EmptyState title={error} detail="Tente atualizar depois de executar o workflow." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="Relatorio de vendas"
        title="Vendas coletadas"
        description="Leitura comercial baseada na coleta D-1 e no historico diario acumulado. Quando ha apenas um dia no historico, os periodos maiores preservam a mesma base demonstravel."
        meta={
          <>
            <StatusPill tone="orange">{labelPeriodo}</StatusPill>
            {periodo?.inicio && <StatusPill tone="muted">{formatDate(periodo.inicio)} a {formatDate(periodo.fim)}</StatusPill>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Receita" value={loading ? '...' : formatBRL(summary.receita_total || 0)} detail="PDV + B2B" tone="orange" />
        <MetricCard label="Volume" value={loading ? '...' : formatNum(summary.volume_vendas || 0)} detail="registros de venda" tone="blue" />
        <MetricCard label="Ticket medio" value={loading ? '...' : formatBRL(summary.ticket_medio || 0)} detail="receita / volume" tone="green" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Receita diaria" subtitle={`Serie ${labelPeriodo}`} className="xl:col-span-2">
          <div className="h-72 p-4">
            {loading ? <LoadingBlock height="h-full" /> : evolucao.length > 0 ? (
              <Bar
                data={{
                  labels: evolucao.map(item => formatDate(item.data)),
                  datasets: [{
                    label: 'Receita',
                    data: evolucao.map(item => Number(item.receita || 0)),
                    backgroundColor: '#ff7a2f',
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
            ) : <EmptyState title="Sem serie no periodo" detail="O historico sera preenchido por execucoes diarias." />}
          </div>
        </Panel>

        <Panel title="Canal de venda" subtitle="Participacao PDV / B2B">
          <div className="h-72 p-4">
            {loading ? <LoadingBlock height="h-full" /> : (summary.receita_pdv || summary.receita_b2b) ? (
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '64%',
                  plugins: { legend: { labels: { color: '#b7b7b7' } } },
                }}
              />
            ) : <EmptyState title="Sem divisao por canal" detail="A coleta D-1 retornou zero para PDV e B2B." />}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Top 10 produtos mais vendidos" subtitle="Ranking pela quantidade vendida no periodo">
          <div className="p-4">
            {loading ? <LoadingBlock /> : topProdutos.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10 text-right">#</th>
                    <th>Produto</th>
                    <th className="text-right">Quantidade</th>
                    <th className="text-right">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProdutos.map((item, index) => (
                    <tr key={`${item.codigo || item.produto}-${index}`}>
                      <td className="text-right text-[var(--text-muted)]">{index + 1}</td>
                      <td className="max-w-[320px]">
                        <div className="truncate font-bold text-[var(--text-primary)]">{item.produto}</div>
                        {item.codigo && (
                          <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                        )}
                      </td>
                      <td className="text-right font-bold text-[var(--info)]">{formatNum(item.quantidade)}</td>
                      <td className="text-right font-bold text-[var(--accent)]">{formatBRL(item.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem produtos no periodo" detail="Nao houve produtos retornados para a janela selecionada." />}
          </div>
        </Panel>

        <Panel title="Clientes B2B" subtitle="Quando o endpoint B2B retornar dados">
          <div className="p-4">
            {loading ? <LoadingBlock /> : topClientes.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Receita</th></tr></thead>
                <tbody>
                  {topClientes.map((item, index) => (
                    <tr key={`${item.cliente}-${index}`}>
                      <td className="max-w-[340px] truncate">{item.cliente}</td>
                      <td className="text-right">{formatNum(item.volume || 0)}</td>
                      <td className="text-right font-bold text-[var(--success)]">{formatBRL(item.receita || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem B2B na coleta" detail="O dia coletado possui dados PDV, mas nao retornou ranking B2B." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}

