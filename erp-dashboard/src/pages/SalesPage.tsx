import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Tooltip, Legend
} from 'chart.js'
import { useErpData } from '../hooks/useErpData'
import { useTriggerColeta } from '../hooks/useTriggerColeta'
import { useApplyRangeFromUrl } from '../hooks/useApplyRangeFromUrl'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { buildApiOptions, formatRangeLabel } from '../utils/period'
import { formatReceitaBreakdown, formatVolumeBreakdown, getBreakdown } from '../utils/acumulado'
import DateRangePicker from '../components/DateRangePicker'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function abbreviateNumber(value: number): string {
  if (value == null || Number.isNaN(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace('.0', '').replace('.', ',') + 'B'
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

// Enumera todos os dias (YYYY-MM-DD) entre inicio e fim, inclusive.
function enumerateDays(inicio?: string, fim?: string): string[] {
  if (!inicio || !fim) return []
  const out: string[] = []
  const start = new Date(inicio + 'T00:00:00')
  const end = new Date(fim + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function fmtDiaCurto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// =====================================================================
// PREVIEW: mock de "Estoque atual dos Top 20" para visualização.
// Variações reais (cor × tamanho) com quantidades realistas, espelhando
// os produtos que aparecem no Top 20 vendidos. Quando o workflow novo
// (CK-VD-1) coletar estoque por SKU, basta desligar essa flag.
// =====================================================================
const PREVIEW_ESTOQUE_TOP20 = false
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG']
const ESTOQUE_TOP20_MOCK_PRODUTOS = [
  { codigo: '02038412', produto: 'BABY LOOK COTTON PREMIUM', cores: ['PRETO', 'BRANCO', 'OFF', 'AZUL MARINHO'], range: [1, 22] },
  { codigo: '04701233', produto: 'REGATA SUPLEX', cores: ['BRANCO', 'PRETO', 'CINZA'], range: [2, 28] },
  { codigo: '08812501', produto: 'CALÇA MOLETOM PELUCIADO', cores: ['CINZA', 'PRETO', 'AZUL MARINHO'], range: [2, 18] },
  { codigo: '03987112', produto: 'CAMISETA BÁSICA COTTON', cores: ['PRETO', 'BRANCO', 'CINZA'], range: [3, 35] },
  { codigo: '06324801', produto: 'BLUSA RIBANA CANELADA', cores: ['PRETO', 'OFF', 'MOSTARDA'], range: [4, 24] },
  { codigo: '05642178', produto: 'LEGGING SUPLEX', cores: ['PRETO', 'CINZA'], range: [2, 30] },
  { codigo: '09127342', produto: 'SHORT TACTEL', cores: ['AZUL MARINHO', 'PRETO'], range: [5, 25] },
  { codigo: '07811923', produto: 'BLUSA MANGA LONGA RIBANA', cores: ['CINZA', 'PRETO', 'OFF'], range: [3, 20] },
  { codigo: '04812370', produto: 'BABY LOOK GOLA V', cores: ['PRETO', 'BRANCO'], range: [2, 18] },
  { codigo: '12056784', produto: 'SHORT BERMUDA MOLETOM', cores: ['PRETO', 'CINZA'], range: [4, 22] },
  { codigo: '06789102', produto: 'TOP FITNESS CROPPED', cores: ['PRETO', 'ROSA'], range: [3, 16] },
  { codigo: '09456321', produto: 'BLUSÃO MOLETOM CAPUZ', cores: ['CINZA', 'PRETO', 'VERDE MILITAR'], range: [4, 14] },
  { codigo: '11293048', produto: 'SHORT BERMUDA TACTEL', cores: ['PRETO', 'AZUL MARINHO'], range: [3, 20] },
  { codigo: '08234561', produto: 'CALÇA LEGGING FITNESS', cores: ['AZUL MARINHO', 'PRETO'], range: [5, 18] },
  { codigo: '13478965', produto: 'CONJUNTO FITNESS', cores: ['PRETO', 'CINZA'], range: [2, 12] },
  { codigo: '04701234', produto: 'CAMISETA POLO PIQUET', cores: ['BRANCO', 'AZUL MARINHO', 'OFF'], range: [6, 26] },
  { codigo: '10568712', produto: 'CALÇA SARJA SLIM', cores: ['PRETO', 'AZUL MARINHO', 'CINZA'], range: [3, 16] },
  { codigo: '14872905', produto: 'JAQUETA MOLETOM ZIPER', cores: ['PRETO', 'CINZA'], range: [2, 10] },
  { codigo: '15983234', produto: 'CAMISETA ESTAMPADA', cores: ['BRANCO', 'PRETO', 'CINZA'], range: [4, 28] },
  { codigo: '17234567', produto: 'BLUSA TRICOT GOLA ALTA', cores: ['PRETO', 'OFF', 'MOSTARDA'], range: [3, 14] },
]

function gerarEstoqueTop20Mock() {
  const linhas: Array<{ codigo: string; produto: string; cor: string; tamanho: string; quantidade: number }> = []
  let seed = 7
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (const p of ESTOQUE_TOP20_MOCK_PRODUTOS) {
    for (const cor of p.cores) {
      // entre 4 e 6 tamanhos por cor
      const qtdTamanhos = 4 + Math.floor(rng() * 3)
      const tamanhosEscolhidos = [...TAMANHOS].slice(0, qtdTamanhos)
      for (const tam of tamanhosEscolhidos) {
        const min = p.range[0]
        const max = p.range[1]
        // quantidade com leve viés para o meio do range
        const q = Math.round(min + rng() * (max - min))
        linhas.push({
          codigo: p.codigo,
          produto: p.produto,
          cor,
          tamanho: tam,
          quantidade: q,
        })
      }
    }
  }
  return linhas
}
const ESTOQUE_TOP20_LINHAS_MOCK = gerarEstoqueTop20Mock()
const ESTOQUE_TOP20_PRODUTOS_MOCK = ESTOQUE_TOP20_MOCK_PRODUTOS.map(p => ({
  codigo: p.codigo,
  produto: p.produto,
}))
// =====================================================================

export default function SalesPage() {
  useApplyRangeFromUrl()
  const { range } = usePeriod()
  const trigger = useTriggerColeta()
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
  const evolucao = useMemo<any[]>(() => d?.evolucao_diaria || [], [d])
  const serieDiaria = useMemo(() => {
    const inicio = d?.periodo?.inicio || range.dataInicial
    const fim = d?.periodo?.fim || range.dataFinal
    const dias = enumerateDays(inicio, fim)
    const mapa = new Map<string, number>()
    for (const item of evolucao) {
      const k = String(item?.data || '').slice(0, 10)
      if (k) mapa.set(k, Number(item.receita || 0))
    }
    return dias.map(dia => ({ data: dia, receita: mapa.get(dia) || 0 }))
  }, [evolucao, d?.periodo?.inicio, d?.periodo?.fim, range.dataInicial, range.dataFinal])
  const produtosVendidos: any[] = d?.produtos_vendidos || d?.top_produtos || []
  const topProdutos: any[] = [...produtosVendidos]
    .map(item => ({
      ...item,
      quantidade: Number(item.quantidade || 0),
      valor_total: Number(item.valor_total ?? item.receita ?? 0),
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 20)
  const estoqueLinhas: any[] = useMemo(() => {
    if (PREVIEW_ESTOQUE_TOP20) return ESTOQUE_TOP20_LINHAS_MOCK
    return d?.estoque_top10_linhas || []
  }, [d?.estoque_top10_linhas])
  const estoquePorProduto: any[] = PREVIEW_ESTOQUE_TOP20
    ? ESTOQUE_TOP20_PRODUTOS_MOCK
    : (d?.estoque_top10 || [])
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

  if (error) {
    return (
      <Panel title="Vendas indisponíveis" subtitle="O N8N retornou erro para este módulo.">
        <div className="p-6">
          <EmptyState title={error} detail="Tente atualizar depois de executar o workflow." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Relatório de vendas"
        title="Vendas coletadas"
        description="Vendas do intervalo selecionado, coletadas sob demanda no ERP Dapic. Receita, Volume e Ticket médio são recalculados sobre todos os produtos vendidos no intervalo."
        meta={
          <>
            <StatusPill tone="orange">
              {periodo?.inicio ? `${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}` : labelPeriodo}
            </StatusPill>
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
        {trigger.isBusy && <StatusPill tone="blue">Atualizando…</StatusPill>}
        {trigger.state === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {trigger.state === 'timeout' && <StatusPill tone="red">Tempo esgotado</StatusPill>}
        {trigger.state === 'error' && <StatusPill tone="red">Falha ao iniciar coleta</StatusPill>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Receita" value={loading ? '...' : formatBRL(summary.receita_total || 0)} detail={`No intervalo · ${receitaDetail}`} tone="orange" />
        <MetricCard label="Volume" value={loading ? '...' : formatNum(summary.volume_vendas || 0)} detail={`No intervalo · ${volumeDetail}`} tone="blue" />
        <MetricCard label="Ticket médio" value={loading ? '...' : formatBRL(summary.ticket_medio || 0)} detail="receita do intervalo / vendas do intervalo" tone="green" />
      </div>

      <div className="mt-4">
        <Panel
          title="Receita diária"
          subtitle={`Uma coluna por dia do intervalo · ${labelPeriodo} (${serieDiaria.length} dias)`}
        >
          <div className="p-3 sm:p-4">
            {loading ? (
              <LoadingBlock height="h-72 sm:h-96" />
            ) : serieDiaria.length > 0 ? (
              <div className="h-72 overflow-x-auto overflow-y-hidden sm:h-96">
                {/* Largura minima dinamica: 42px por dia em mobile, 56px em tela maior
                    para que TODAS as colunas e labels apareçam sem cortar. */}
                <div
                  className="h-full"
                  style={{
                    minWidth: `${Math.max(serieDiaria.length * 42, 320)}px`,
                  }}
                >
                  <Bar
                    data={{
                      labels: serieDiaria.map(item => fmtDiaCurto(item.data)),
                      datasets: [{
                        label: 'Receita',
                        data: serieDiaria.map(item => Number(item.receita || 0)),
                        backgroundColor: '#ff7a2f',
                        borderRadius: 4,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      layout: { padding: { top: 22 } },
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx: any) => formatBRL(Number(ctx.parsed.y || 0)),
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#a8a8a8',
                            font: { size: 10 },
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                          },
                          grid: { color: 'rgba(255,255,255,.05)' },
                        },
                        y: {
                          ticks: {
                            color: '#747474',
                            font: { size: 11 },
                            callback: (v: any) => abbreviateNumber(Number(v)),
                          },
                          grid: { color: 'rgba(255,255,255,.06)' },
                        },
                      },
                    }}
                    plugins={[valueOnBarsPlugin]}
                  />
                </div>
              </div>
            ) : (
              <EmptyState title="Sem série no período" detail="Defina um intervalo válido para visualizar a série diária." />
            )}
            {serieDiaria.length > 14 && (
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                Arraste horizontalmente para ver todos os {serieDiaria.length} dias.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Top 20 produtos mais vendidos" subtitle="Ranking pela quantidade vendida no período">
          <div className="p-3 sm:p-4">
            {loading ? <LoadingBlock /> : topProdutos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th className="w-10 text-right">#</th>
                      <th>Produto</th>
                      <th className="text-right whitespace-nowrap">Qtd.</th>
                      <th className="text-right whitespace-nowrap">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProdutos.map((item, index) => (
                      <tr key={`${item.codigo || item.produto}-${index}`}>
                        <td className="text-right text-[var(--text-muted)]">{index + 1}</td>
                        <td>
                          <div className="break-words font-bold text-[var(--text-primary)]">{item.produto}</div>
                          {item.codigo && (
                            <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                          )}
                        </td>
                        <td className="text-right font-bold text-[var(--info)] whitespace-nowrap">{formatNum(item.quantidade)}</td>
                        <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">{formatBRL(item.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="Sem produtos no período" detail="Não houve produtos retornados para a janela selecionada." />}
          </div>
        </Panel>

        <Panel
          title="Estoque atual dos Top 20"
          subtitle={
            estoquePorProduto.length > 0
              ? `${estoqueFiltrado.length} de ${estoqueLinhas.length} variacoes em ${estoquePorProduto.length} produtos`
              : 'Saldo por cor e tamanho (snapshot atual)'
          }
        >
          {PREVIEW_ESTOQUE_TOP20 && (
            <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--accent)]/50 bg-[var(--accent-soft)]/30 p-2 sm:mx-4">
              <StatusPill tone="orange">PREVIEW</StatusPill>
              <span className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">
                Estoque simulado · ativado quando workflow CK-VD-1 coletar SKUs reais
              </span>
            </div>
          )}
          <div className="max-h-[40rem] overflow-auto px-3 pb-4 pt-3 sm:px-4">
            {loading ? <LoadingBlock /> : estoqueLinhas.length > 0 ? (
              <table className="data-table min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th className="pt-4">Produto</th>
                    <th className="pt-4">Cor</th>
                    <th className="pt-4 text-center whitespace-nowrap">Tam.</th>
                    <th className="pt-4 text-right whitespace-nowrap">Qtd.</th>
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
                      <td>
                        <div className="break-words font-bold text-[var(--text-primary)]">{item.produto}</div>
                        {item.codigo && (
                          <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                        )}
                      </td>
                      <td className="text-[var(--text-secondary)]">{item.cor || '-'}</td>
                      <td className="text-center font-bold text-[var(--text-primary)] whitespace-nowrap">{item.tamanho || '-'}</td>
                      <td className="text-right font-bold text-[var(--info)] whitespace-nowrap">{formatNum(item.quantidade)}</td>
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
            ) : <EmptyState title="Estoque dos Top 20 ainda não disponível" detail="Clique em Atualizar para executar uma nova coleta — o workflow já cruza top vendidos com estoque atual." />}
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
