import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { periodDays, periodLabel } from '../utils/period'
import { formatReceitaBreakdown, formatVolumeBreakdown, getBreakdown } from '../utils/acumulado'
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

  const topProdutos: any[] = (vendasData?.top_produtos || vendasData?.produtos_vendidos || [])
    .map((item: any) => ({
      ...item,
      quantidade: Number(item.quantidade || 0),
      valor_total: Number(item.valor_total || item.receita || 0),
    }))
    .sort((a: any, b: any) => b.valor_total - a.valor_total)
    .slice(0, 6)
  const fluxo = fluxoData?.projecao_4_semanas || []
  const fluxoResumo = fluxoData?.summary || {}
  const saldoFinanceiro = Number(
    r?.saldo_liquido ||
    fluxoResumo.saldo ||
    (Number(fluxoResumo.pagamentos_realizados || 0) - Number(fluxoResumo.aberto_previsto || 0)) ||
    0
  )
  const fluxoFinanceiroValores = [
    Number(fluxoResumo.pagamentos_realizados ?? fluxoResumo.entradas ?? 0),
    Number(fluxoResumo.aberto_previsto ?? 0),
  ]
  const fluxoFinanceiroTemResumo = fluxoFinanceiroValores.some(value => value > 0)
  const linhasEstoque: any[] = estoqueData?.linhas || estoqueData?.saldo_dia || []
  const baixoEstoque = linhasEstoque
    .map((item: any) => ({
      ...item,
      estoque_atual: Number(item.estoque_atual ?? item.estoque ?? item.quantidade ?? 0),
      vendido_hoje: Number(item.vendido_hoje || 0),
      produto: item.produto || item.Produto || 'Produto nao informado',
      detalhe: [item.cor, item.tamanho].filter(Boolean).join(' / '),
    }))
    .filter((item: any) => item.vendido_hoje > 0 || item.estoque_atual <= 5)
    .sort((a: any, b: any) => {
      const scoreA = a.estoque_atual - (a.vendido_hoje * 2)
      const scoreB = b.estoque_atual - (b.vendido_hoje * 2)
      return scoreA - scoreB
    })
    .slice(0, 15)
  const recebendo7d: any[] = crData?.recebendo_7d?.slice(0, 5) || []

  const breakdown = getBreakdown(r) || getBreakdown(vendasData)
  const receitaDetail = formatReceitaBreakdown(breakdown, formatBRL)
  const volumeDetail = formatVolumeBreakdown(breakdown, formatNum)

  const partialErrors = [resumo.error, vendas.error, estoque.error, contasReceber.error, fluxoCaixa.error].filter(Boolean)
  const loading = resumo.loading || vendas.loading

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="ERP Dapic / Command Center"
        title="Visao Geral Executiva"
        description="Cron 06h fecha ontem; Atualizar soma o que vende hoje em tempo real. Estoque e financeiro refletem a ultima coleta (preferencia ao vivo)."
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
          label="Receita acumulada"
          value={loading ? '...' : formatBRL(r?.receita_total || 0)}
          detail={receitaDetail || `${formatNum(r?.volume_vendas || 0)} vendas no periodo`}
          tone="orange"
        />
        <MetricCard
          label="Ticket medio"
          value={loading ? '...' : formatBRL(r?.ticket_medio || 0)}
          detail={volumeDetail || `PDV ${formatBRL(r?.receita_pdv || 0)}`}
          tone="green"
        />
        <MetricCard
          label="Estoque monitorado"
          value={estoque.loading ? '...' : formatNum(estoqueData?.summary?.total_skus || linhasEstoque.length || 0)}
          detail={`${formatNum(r?.skus_criticos || 0)} criticos / ${formatNum(r?.skus_alerta || 0)} alerta`}
          tone="blue"
        />
        <MetricCard
          label="Saldo CR - CP"
          value={(resumo.loading || fluxoCaixa.loading) ? '...' : formatBRL(saldoFinanceiro)}
          detail={r?.saldo_liquido ? 'CR - CP retornado pelo ERP' : 'Pagos D-1 - parcelas abertas'}
          tone={saldoFinanceiro >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Produtos de maior receita" subtitle={`Ranking do ${periodLabel(period)} por valor vendido`}>
          <div className="h-72 p-4">
            {vendas.loading ? <LoadingBlock height="h-full" /> : topProdutos.length > 0 ? (
              <Bar
                data={{
                  labels: topProdutos.map(item => String(item.produto || '').slice(0, 22)),
                  datasets: [{
                    label: 'Receita',
                    data: topProdutos.map(item => item.valor_total),
                    backgroundColor: '#ff7a2f',
                    borderRadius: 5,
                  }],
                }}
                options={chartBase as any}
              />
            ) : <EmptyState title="Sem produtos vendidos" detail="A coleta D-1 nao retornou produtos para ranquear." />}
          </div>
        </Panel>

        <Panel title="Fluxo financeiro" subtitle="Pagamentos realizados e parcelas abertas">
          <div className="h-72 p-4">
            {fluxoCaixa.loading ? <LoadingBlock height="h-full" /> : fluxoFinanceiroTemResumo ? (
              <Bar
                data={{
                  labels: ['Pagamentos D-1', 'Parcelas abertas'],
                  datasets: [{
                    label: 'Valor',
                    data: fluxoFinanceiroValores,
                    backgroundColor: ['#42d392', '#ff7a2f'],
                    borderRadius: 5,
                  }],
                }}
                options={{ ...chartBase, plugins: { legend: { display: false } } } as any}
              />
            ) : fluxo.length > 0 ? (
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
        <Panel title="Estoque em atencao" subtitle="Variações vendidas com menor cobertura">
          <div className="overflow-x-auto p-4">
            {estoque.loading ? <LoadingBlock /> : baixoEstoque.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Produto</th><th>Variação</th><th className="text-right">Vendido</th><th className="text-right">Estoque</th></tr></thead>
                <tbody>
                  {baixoEstoque.map((item, index) => (
                    <tr key={`${item.codigo}-${index}`}>
                      <td className="max-w-[260px] truncate">{item.produto}</td>
                      <td className="max-w-[140px] truncate text-[var(--text-muted)]">{item.detalhe || '-'}</td>
                      <td className="text-right text-[var(--text-secondary)]">{formatNum(item.vendido_hoje)}</td>
                      <td className="text-right font-bold text-[var(--accent)]">{formatNum(item.estoque_atual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem estoque para listar" detail="O modulo de estoque ainda nao retornou variações demonstraveis." />}
          </div>
        </Panel>

        <Panel title="Parcelas proximas" subtitle="Registros financeiros em aberto">
          <div className="overflow-x-auto p-4">
            {contasReceber.loading ? <LoadingBlock /> : recebendo7d.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Pessoa</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {recebendo7d.map((item, index) => (
                    <tr key={`${item.id || item.id_parcela || item.id_conta}-${index}`}>
                      <td className="max-w-[320px] truncate">{item.cliente || item.pessoa || 'Pessoa nao informada'}</td>
                      <td className="text-right font-bold text-[var(--success)]">{formatBRL(item.valor ?? item.valor_aberto ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem parcelas proximas" detail="A coleta nao retornou parcelas em aberto para a janela atual." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}
