import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { buildApiOptions, formatRangeLabel } from '../utils/period'
import { formatReceitaBreakdown, formatVolumeBreakdown, getBreakdown } from '../utils/acumulado'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'
import DateRangePicker from '../components/DateRangePicker'
import { useTriggerColeta } from '../hooks/useTriggerColeta'

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
  const { range } = usePeriod()
  const { state: coletaState, run: runColeta, isBusy: coletaBusy } = useTriggerColeta()
  const fetchOptions = buildApiOptions(range)
  const rangeKey = `${range.dataInicial}|${range.dataFinal}`

  const resumo = useErpData(() => api.resumo(fetchOptions), [rangeKey])
  const vendas = useErpData(() => api.vendas(fetchOptions), [rangeKey])
  const estoque = useErpData(() => api.estoque(fetchOptions), [rangeKey])
  const contasReceber = useErpData(() => api.contasReceber(fetchOptions), [rangeKey])
  const fluxoCaixa = useErpData(() => api.fluxoCaixa(fetchOptions), [rangeKey])

  const r = resumo.data as Record<string, unknown> | null
  const vendasData = (vendas.data as { dados?: Record<string, unknown> })?.dados
  const estoqueData = (estoque.data as { dados?: Record<string, unknown> })?.dados
  const crData = (contasReceber.data as { dados?: Record<string, unknown> })?.dados
  const fluxoData = (fluxoCaixa.data as { dados?: Record<string, unknown> })?.dados

  const topProdutos: Array<Record<string, unknown>> = (
    (vendasData?.top_produtos as unknown[]) ||
    (vendasData?.produtos_vendidos as unknown[]) ||
    []
  )
    .map((item: unknown) => {
      const row = item as Record<string, unknown>
      return {
        ...row,
        quantidade: Number(row.quantidade || 0),
        valor_total: Number(row.valor_total || row.receita || 0),
      }
    })
    .sort((a, b) => (b.valor_total as number) - (a.valor_total as number))
    .slice(0, 6)

  const fluxo = (fluxoData?.projecao_4_semanas as unknown[]) || []
  const fluxoResumo = (fluxoData?.summary as Record<string, number>) || {}
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
  const linhasEstoque: Array<Record<string, unknown>> =
    (estoqueData?.linhas as Array<Record<string, unknown>>) ||
    (estoqueData?.saldo_dia as Array<Record<string, unknown>>) ||
    []
  const baixoEstoque = linhasEstoque
    .map((item) => ({
      ...item,
      estoque_atual: Number(item.estoque_atual ?? item.estoque ?? item.quantidade ?? 0),
      vendido_hoje: Number(item.vendido_hoje || 0),
      produto: item.produto || item.Produto || 'Produto nao informado',
      detalhe: [item.cor, item.tamanho].filter(Boolean).join(' / '),
    }))
    .filter((item) => item.vendido_hoje > 0 || item.estoque_atual <= 5)
    .sort((a, b) => {
      const scoreA = a.estoque_atual - (a.vendido_hoje * 2)
      const scoreB = b.estoque_atual - (b.vendido_hoje * 2)
      return scoreA - scoreB
    })
    .slice(0, 15)
  const recebendo7d: Array<Record<string, unknown>> =
    (crData?.recebendo_7d as Array<Record<string, unknown>>)?.slice(0, 5) || []

  const breakdown = getBreakdown(r) || getBreakdown(vendasData)
  const receitaDetail = formatReceitaBreakdown(breakdown, formatBRL)
  const volumeDetail = formatVolumeBreakdown(breakdown, formatNum)

  const partialErrors = [resumo.error, vendas.error, estoque.error, contasReceber.error, fluxoCaixa.error].filter(Boolean)
  const loading = resumo.loading || vendas.loading
  const periodoConsultado = r?.periodo as { inicio?: string; fim?: string } | undefined
  const labelConsulta =
    periodoConsultado?.inicio && periodoConsultado?.fim
      ? formatRangeLabel(periodoConsultado.inicio, periodoConsultado.fim)
      : formatRangeLabel(range.dataInicial, range.dataFinal)

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="ERP Dapic / Command Center"
        title="Visao Geral Executiva"
        description="Defina o intervalo: ao alterar, os dados sao recoletados automaticamente no Dapic. Vendas, caixa e recebiveis seguem o intervalo; estoque e a posicao atual (snapshot)."
        meta={
          <>
            <StatusPill tone="orange">{labelConsulta}</StatusPill>
            {r?.atualizadoEm && (
              <StatusPill tone="muted">
                Coletado {formatDate(String(r.atualizadoEm))}
              </StatusPill>
            )}
            {partialErrors.length > 0 && (
              <StatusPill tone="red">{partialErrors.length} alerta(s)</StatusPill>
            )}
          </>
        }
      />

      <div className="mb-4">
        <DateRangePicker
          showAtualizar
          onAtualizar={() => runColeta(r?.atualizadoEm as string | undefined)}
          atualizando={coletaBusy}
        />
        {coletaState === 'error' && (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Falha ao iniciar coleta. Verifique VITE_N8N_WEBHOOK_URL e o workflow no N8N.
          </p>
        )}
        {coletaState === 'timeout' && (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Coleta demorou mais que o esperado. Tente novamente ou reduza o intervalo.
          </p>
        )}
        {!r?.receita_total && !loading && !resumo.error && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Sem dados para este intervalo. Clique em Atualizar para coletar no ERP.
          </p>
        )}
      </div>

      {partialErrors.length > 0 && (
        <Panel title="Alertas de dados" subtitle="Alguns modulos retornaram erro ou ainda nao foram coletados." className="mb-4">
          <div className="p-4 text-sm text-[var(--text-secondary)]">
            {partialErrors.map((error, index) => (
              <p key={index} className="m-0 py-1">{error}</p>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita acumulada"
          value={loading ? '...' : formatBRL(Number(r?.receita_total || 0))}
          detail={receitaDetail || `${formatNum(Number(r?.volume_vendas || 0))} vendas no periodo`}
          tone="orange"
        />
        <MetricCard
          label="Ticket medio"
          value={loading ? '...' : formatBRL(Number(r?.ticket_medio || 0))}
          detail={volumeDetail || `PDV ${formatBRL(Number(r?.receita_pdv || 0))}`}
          tone="green"
        />
        <MetricCard
          label="Estoque monitorado"
          value={estoque.loading ? '...' : formatNum(Number((estoqueData?.summary as Record<string, number>)?.total_skus || linhasEstoque.length || 0))}
          detail={`${formatNum(Number(r?.skus_criticos || 0))} criticos / ${formatNum(Number(r?.skus_alerta || 0))} alerta · snapshot`}
          tone="blue"
        />
        <MetricCard
          label="Saldo CR - CP"
          value={(resumo.loading || fluxoCaixa.loading) ? '...' : formatBRL(saldoFinanceiro)}
          detail={r?.saldo_liquido ? 'CR - CP retornado pelo ERP' : 'Pagos - parcelas abertas'}
          tone={saldoFinanceiro >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Produtos de maior receita" subtitle={`Ranking de ${labelConsulta}`}>
          <div className="h-72 p-4">
            {vendas.loading ? <LoadingBlock height="h-full" /> : topProdutos.length > 0 ? (
              <Bar
                data={{
                  labels: topProdutos.map(item => String(item.produto || '').slice(0, 22)),
                  datasets: [{
                    label: 'Receita',
                    data: topProdutos.map(item => item.valor_total as number),
                    backgroundColor: '#ff7a2f',
                    borderRadius: 5,
                  }],
                }}
                options={chartBase as object}
              />
            ) : (
              <EmptyState
                title="Sem produtos no periodo"
                detail="Atualize para coletar vendas do intervalo selecionado."
              />
            )}
          </div>
        </Panel>

        <Panel title="Fluxo financeiro" subtitle="Pagamentos realizados e parcelas abertas">
          <div className="h-72 p-4">
            {fluxoCaixa.loading ? <LoadingBlock height="h-full" /> : fluxoFinanceiroTemResumo ? (
              <Bar
                data={{
                  labels: ['Pagamentos', 'Parcelas abertas'],
                  datasets: [{
                    label: 'Valor',
                    data: fluxoFinanceiroValores,
                    backgroundColor: ['#42d392', '#ff7a2f'],
                    borderRadius: 5,
                  }],
                }}
                options={{ ...chartBase, plugins: { legend: { display: false } } } as object}
              />
            ) : fluxo.length > 0 ? (
              <Bar
                data={{
                  labels: (fluxo as Array<Record<string, unknown>>).map(item => String(item.semana)),
                  datasets: [
                    { label: 'Entradas', data: (fluxo as Array<Record<string, unknown>>).map(item => Number(item.entradas_previstas)), backgroundColor: '#42d392', borderRadius: 4 },
                    { label: 'Saidas', data: (fluxo as Array<Record<string, unknown>>).map(item => Number(item.saidas_previstas)), backgroundColor: '#ff5f57', borderRadius: 4 },
                  ],
                }}
                options={{ ...chartBase, plugins: { legend: { labels: { color: '#b7b7b7' } } } } as object}
              />
            ) : (
              <EmptyState title="Sem movimentacao financeira" detail="Modulo financeiro ainda nao retornou dados para o periodo." />
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Estoque em atencao" subtitle="Snapshot atual (nao filtra por periodo)">
          <div className="overflow-x-auto p-4">
            {estoque.loading ? <LoadingBlock /> : baixoEstoque.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Produto</th><th>Variação</th><th className="text-right">Vendido</th><th className="text-right">Estoque</th></tr></thead>
                <tbody>
                  {baixoEstoque.map((item, index) => (
                    <tr key={`${String(item.codigo)}-${index}`}>
                      <td className="max-w-[260px] truncate">{String(item.produto)}</td>
                      <td className="max-w-[140px] truncate text-[var(--text-muted)]">{String(item.detalhe || '-')}</td>
                      <td className="text-right text-[var(--text-secondary)]">{formatNum(Number(item.vendido_hoje))}</td>
                      <td className="text-right font-bold text-[var(--accent)]">{formatNum(Number(item.estoque_atual))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem estoque para listar" detail="O modulo de estoque ainda nao retornou variações." />}
          </div>
        </Panel>

        <Panel title="Parcelas proximas" subtitle="Registros financeiros em aberto">
          <div className="overflow-x-auto p-4">
            {contasReceber.loading ? <LoadingBlock /> : recebendo7d.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Pessoa</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {recebendo7d.map((item, index) => (
                    <tr key={`${String(item.id || item.id_parcela || item.id_conta)}-${index}`}>
                      <td className="max-w-[320px] truncate">{String(item.cliente || item.pessoa || 'Pessoa nao informada')}</td>
                      <td className="text-right font-bold text-[var(--success)]">{formatBRL(Number(item.valor ?? item.valor_aberto ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="Sem parcelas proximas" detail="A coleta nao retornou parcelas em aberto." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}
