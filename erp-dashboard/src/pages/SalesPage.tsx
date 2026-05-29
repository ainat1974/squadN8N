import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { buildApiOptions, formatRangeLabel } from '../utils/period'
import { formatReceitaBreakdown, formatVolumeBreakdown, getBreakdown } from '../utils/acumulado'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function SalesPage() {
  const { range } = usePeriod()
  const [estoqueFilters, setEstoqueFilters] = useState({
    produto: '',
    cor: '',
    tamanho: '',
    quantidadeMinima: '',
  })
  const fetchOptions = buildApiOptions(range)
  const labelPeriodo = formatRangeLabel(range.dataInicial, range.dataFinal)
  const rangeKey = `${range.dataInicial}|${range.dataFinal}`
  const { data, loading, error, refresh } = useErpData(
    () => api.vendas(fetchOptions),
    [rangeKey],
  )

  const response = data as any
  const d = response?.dados
  const summary = d?.summary || {}
  const breakdown = getBreakdown(d)
  const receitaDetail = formatReceitaBreakdown(breakdown, formatBRL) || 'PDV + B2B (acumulado)'
  const volumeDetail = formatVolumeBreakdown(breakdown, formatNum) || 'registros de venda (acumulado)'
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
  const estoqueLinhas: any[] = useMemo(() => d?.estoque_top10_linhas || [], [d?.estoque_top10_linhas])
  const estoquePorProduto: any[] = d?.estoque_top10 || []
  const estoqueFiltrado = useMemo(() => {
    const produto = estoqueFilters.produto.trim().toLowerCase()
    const cor = estoqueFilters.cor.trim().toLowerCase()
    const tamanho = estoqueFilters.tamanho.trim().toLowerCase()
    const quantidadeMinima = Number(estoqueFilters.quantidadeMinima || 0)

    return estoqueLinhas.filter((item) => {
      const produtoTexto = `${item.produto || ''} ${item.codigo || ''}`.toLowerCase()
      const corTexto = String(item.cor || '').toLowerCase()
      const tamanhoTexto = String(item.tamanho || '').toLowerCase()
      const quantidade = Number(item.quantidade || 0)

      return (
        (!produto || produtoTexto.includes(produto)) &&
        (!cor || corTexto.includes(cor)) &&
        (!tamanho || tamanhoTexto.includes(tamanho)) &&
        (!quantidadeMinima || quantidade >= quantidadeMinima)
      )
    })
  }, [estoqueFilters, estoqueLinhas])
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
        description="Vendas do intervalo selecionado, coletadas sob demanda no ERP Dapic. Ao trocar o intervalo, os dados sao recoletados automaticamente."
        meta={
          <>
            <StatusPill tone="orange">
              {periodo?.inicio ? `${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}` : labelPeriodo}
            </StatusPill>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Receita" value={loading ? '...' : formatBRL(summary.receita_total || 0)} detail={receitaDetail} tone="orange" />
        <MetricCard label="Volume" value={loading ? '...' : formatNum(summary.volume_vendas || 0)} detail={volumeDetail} tone="blue" />
        <MetricCard label="Ticket medio" value={loading ? '...' : formatBRL(summary.ticket_medio || 0)} detail="receita acumulada / volume" tone="green" />
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
          <div className="overflow-x-auto p-4">
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

        <Panel
          title="Estoque atual dos Top 10"
          subtitle={
            estoquePorProduto.length > 0
              ? `${estoqueFiltrado.length} de ${estoqueLinhas.length} variacoes em ${estoquePorProduto.length} produtos`
              : 'Saldo por cor e tamanho'
          }
        >
          <div className="max-h-[40rem] overflow-auto px-4 pb-4">
            {loading ? <LoadingBlock /> : estoqueLinhas.length > 0 ? (
              <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th className="pt-4">Produto</th>
                    <th className="pt-4">Cor</th>
                    <th className="pt-4 text-center">Tamanho</th>
                    <th className="pt-4 text-right">Quantidade</th>
                  </tr>
                  <tr className="[&>th]:sticky [&>th]:top-[41px] [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th>
                      <ColumnFilter
                        label="Filtrar produto ou SKU"
                        value={estoqueFilters.produto}
                        onChange={(value) => setEstoqueFilters(current => ({ ...current, produto: value }))}
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Filtrar cor"
                        value={estoqueFilters.cor}
                        onChange={(value) => setEstoqueFilters(current => ({ ...current, cor: value }))}
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Filtrar tam."
                        value={estoqueFilters.tamanho}
                        onChange={(value) => setEstoqueFilters(current => ({ ...current, tamanho: value }))}
                        align="center"
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Min."
                        value={estoqueFilters.quantidadeMinima}
                        onChange={(value) => setEstoqueFilters(current => ({ ...current, quantidadeMinima: value }))}
                        type="number"
                        align="right"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estoqueFiltrado.map((item, index) => (
                    <tr key={`${item.codigo}-${item.cor}-${item.tamanho}-${index}`}>
                      <td className="max-w-[260px]">
                        <div className="truncate font-bold text-[var(--text-primary)]">{item.produto}</div>
                        {item.codigo && (
                          <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                        )}
                      </td>
                      <td className="text-[var(--text-secondary)]">{item.cor || '-'}</td>
                      <td className="text-center font-bold text-[var(--text-primary)]">{item.tamanho || '-'}</td>
                      <td className="text-right font-bold text-[var(--info)]">{formatNum(item.quantidade)}</td>
                    </tr>
                  ))}
                  {estoqueFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState title="Nenhum item encontrado" detail="Ajuste os filtros para ampliar a busca." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : <EmptyState title="Sem estoque na coleta" detail="O snapshot atual nao retornou variacoes para os top 10." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ColumnFilter({
  label,
  value,
  onChange,
  type = 'text',
  align = 'left',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  align?: 'left' | 'center' | 'right'
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <input
      aria-label={label}
      className={`h-8 w-full rounded-md border border-[var(--border)] bg-black/30 px-2 text-xs normal-case text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)] ${alignClass}`}
      min={type === 'number' ? 0 : undefined}
      placeholder={label}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
