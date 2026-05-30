import { useMemo, useState } from 'react'
import { useErpData } from '../hooks/useErpData'
import { useTriggerColeta } from '../hooks/useTriggerColeta'
import { api, formatBRL, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { buildApiOptions } from '../utils/period'
import DateRangePicker from '../components/DateRangePicker'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

// =====================================================================
// PREVIEW: mock realista para a página Estoque enquanto o backend
// (workflow legado) ainda não popula os endpoints com dados ricos.
// Quando o workflow N8N dedicado de Estoque entrar, basta desligar a flag.
// =====================================================================
const PREVIEW_ESTOQUE = true

const CORES_BASE = ['PRETO', 'BRANCO', 'CINZA', 'AZUL MARINHO', 'OFF', 'MOSTARDA', 'ROSA']
const TAMANHOS_BASE = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

const ESTOQUE_GRUPOS_MOCK = [
  {
    grupo: 'BABY LOOK',
    custoMedio: 38.5,
    produtos: [
      { codigo: '02038412', produto: 'BABY LOOK COTTON PREMIUM', cores: ['PRETO', 'BRANCO', 'OFF', 'AZUL MARINHO'], no_top10: true, range: [1, 28] },
      { codigo: '04812370', produto: 'BABY LOOK GOLA V', cores: ['PRETO', 'BRANCO'], no_top10: true, range: [2, 20] },
      { codigo: '04812380', produto: 'BABY LOOK MANGA LONGA', cores: ['PRETO', 'CINZA'], no_top10: false, range: [3, 18] },
      { codigo: '04812390', produto: 'BABY LOOK ESTAMPADA', cores: ['BRANCO', 'PRETO', 'ROSA'], no_top10: false, range: [4, 15] },
    ],
  },
  {
    grupo: 'REGATA',
    custoMedio: 22.8,
    produtos: [
      { codigo: '04701233', produto: 'REGATA SUPLEX', cores: ['BRANCO', 'PRETO', 'CINZA'], no_top10: true, range: [2, 32] },
      { codigo: '04701244', produto: 'REGATA COTTON RIBANA', cores: ['PRETO', 'OFF'], no_top10: false, range: [4, 22] },
      { codigo: '04701255', produto: 'REGATA NADADOR', cores: ['BRANCO', 'PRETO'], no_top10: false, range: [3, 16] },
    ],
  },
  {
    grupo: 'CALÇA / LEGGING',
    custoMedio: 56.4,
    produtos: [
      { codigo: '08812501', produto: 'CALÇA MOLETOM PELUCIADO', cores: ['CINZA', 'PRETO', 'AZUL MARINHO'], no_top10: true, range: [2, 22] },
      { codigo: '05642178', produto: 'LEGGING SUPLEX', cores: ['PRETO', 'CINZA'], no_top10: true, range: [2, 30] },
      { codigo: '08234561', produto: 'CALÇA LEGGING FITNESS', cores: ['AZUL MARINHO', 'PRETO'], no_top10: false, range: [4, 18] },
      { codigo: '10568712', produto: 'CALÇA SARJA SLIM', cores: ['PRETO', 'AZUL MARINHO', 'CINZA'], no_top10: false, range: [3, 14] },
    ],
  },
  {
    grupo: 'CAMISETA',
    custoMedio: 28.2,
    produtos: [
      { codigo: '03987112', produto: 'CAMISETA BÁSICA COTTON', cores: ['PRETO', 'BRANCO', 'CINZA'], no_top10: true, range: [3, 38] },
      { codigo: '04701234', produto: 'CAMISETA POLO PIQUET', cores: ['BRANCO', 'AZUL MARINHO', 'OFF'], no_top10: true, range: [6, 28] },
      { codigo: '15983234', produto: 'CAMISETA ESTAMPADA', cores: ['BRANCO', 'PRETO', 'CINZA'], no_top10: false, range: [4, 30] },
      { codigo: '15983235', produto: 'CAMISETA MANGA LONGA', cores: ['PRETO', 'CINZA', 'MOSTARDA'], no_top10: false, range: [3, 18] },
    ],
  },
  {
    grupo: 'BLUSA / TRICOT',
    custoMedio: 42.0,
    produtos: [
      { codigo: '06324801', produto: 'BLUSA RIBANA CANELADA', cores: ['PRETO', 'OFF', 'MOSTARDA'], no_top10: true, range: [4, 24] },
      { codigo: '07811923', produto: 'BLUSA MANGA LONGA RIBANA', cores: ['CINZA', 'PRETO', 'OFF'], no_top10: false, range: [3, 20] },
      { codigo: '17234567', produto: 'BLUSA TRICOT GOLA ALTA', cores: ['PRETO', 'OFF', 'MOSTARDA'], no_top10: false, range: [3, 14] },
    ],
  },
  {
    grupo: 'MOLETOM / CASACO',
    custoMedio: 78.5,
    produtos: [
      { codigo: '09456321', produto: 'BLUSÃO MOLETOM CAPUZ', cores: ['CINZA', 'PRETO'], no_top10: true, range: [4, 18] },
      { codigo: '14872905', produto: 'JAQUETA MOLETOM ZIPER', cores: ['PRETO', 'CINZA'], no_top10: false, range: [2, 12] },
      { codigo: '14872910', produto: 'CASACO TRICOT LONGO', cores: ['PRETO', 'MOSTARDA'], no_top10: false, range: [2, 10] },
    ],
  },
  {
    grupo: 'SHORT / BERMUDA',
    custoMedio: 32.0,
    produtos: [
      { codigo: '09127342', produto: 'SHORT TACTEL', cores: ['AZUL MARINHO', 'PRETO'], no_top10: true, range: [5, 28] },
      { codigo: '11293048', produto: 'SHORT BERMUDA TACTEL', cores: ['PRETO', 'AZUL MARINHO'], no_top10: false, range: [3, 22] },
      { codigo: '12056784', produto: 'SHORT BERMUDA MOLETOM', cores: ['PRETO', 'CINZA'], no_top10: false, range: [4, 20] },
    ],
  },
  {
    grupo: 'FITNESS',
    custoMedio: 48.0,
    produtos: [
      { codigo: '06789102', produto: 'TOP FITNESS CROPPED', cores: ['PRETO', 'ROSA'], no_top10: true, range: [3, 16] },
      { codigo: '13478965', produto: 'CONJUNTO FITNESS', cores: ['PRETO', 'CINZA'], no_top10: false, range: [2, 12] },
    ],
  },
]

function gerarEstoqueMock() {
  let seed = 11
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const linhas: Array<Record<string, any>> = []
  const grupos: Array<Record<string, any>> = []

  for (const g of ESTOQUE_GRUPOS_MOCK) {
    let groupVendidoHoje = 0
    let groupEstoque = 0
    let groupCusto = 0
    const produtosOut: Array<Record<string, any>> = []

    for (const p of g.produtos) {
      const variacoes: Array<Record<string, any>> = []
      let prodVendido = 0
      let prodEstoque = 0
      let prodCusto = 0

      for (const cor of p.cores) {
        const qtdTamanhos = 4 + Math.floor(rng() * 3) // 4 a 6 tamanhos
        const tamanhos = TAMANHOS_BASE.slice(0, qtdTamanhos)
        for (const tam of tamanhos) {
          const estoque = Math.round(p.range[0] + rng() * (p.range[1] - p.range[0]))
          const vendidoHoje = Math.round(rng() * Math.max(3, estoque * 0.3))
          const custo = estoque * g.custoMedio

          variacoes.push({
            cor, tamanho: tam,
            vendido_hoje: vendidoHoje,
            estoque,
          })
          prodVendido += vendidoHoje
          prodEstoque += estoque
          prodCusto += custo

          linhas.push({
            grupo: g.grupo,
            codigo: p.codigo,
            produto: p.produto,
            cor, tamanho: tam,
            vendido_hoje: vendidoHoje,
            estoque,
          })
        }
      }

      produtosOut.push({
        codigo: p.codigo,
        id_produto: p.codigo,
        produto: p.produto,
        no_top10: p.no_top10,
        vendido_hoje: prodVendido,
        estoque_total: prodEstoque,
        valor_custo_estoque: Math.round(prodCusto * 100) / 100,
        variacoes,
      })

      groupVendidoHoje += prodVendido
      groupEstoque += prodEstoque
      groupCusto += prodCusto
    }

    grupos.push({
      grupo: g.grupo,
      total_produtos: g.produtos.length,
      total_vendido_hoje: groupVendidoHoje,
      total_estoque: groupEstoque,
      valor_custo_estoque: Math.round(groupCusto * 100) / 100,
      produtos: produtosOut,
    })
  }

  const totalProdutos = grupos.reduce((s, g) => s + Number(g.total_produtos || 0), 0)
  const totalEstoque = grupos.reduce((s, g) => s + Number(g.total_estoque || 0), 0)
  const totalVendido = grupos.reduce((s, g) => s + Number(g.total_vendido_hoje || 0), 0)
  const valorCusto = grupos.reduce((s, g) => s + Number(g.valor_custo_estoque || 0), 0)

  return {
    summary: {
      total_grupos: grupos.length,
      total_produtos: totalProdutos,
      total_estoque: totalEstoque,
      total_vendido_hoje: totalVendido,
      valor_custo_estoque: Math.round(valorCusto * 100) / 100,
    },
    grupos,
    linhas,
  }
}

const ESTOQUE_MOCK = gerarEstoqueMock()
// =====================================================================

export default function StockPage() {
  const { range } = usePeriod()
  const fetchOptions = buildApiOptions(range)
  const rangeKey = `${range.dataInicial}|${range.dataFinal}`
  const trigger = useTriggerColeta()
  const { data, loading, error, refresh } = useErpData(
    () => api.estoque(fetchOptions),
    [rangeKey],
  )
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null)
  const [listaFilters, setListaFilters] = useState({
    grupo: '',
    produto: '',
    cor: '',
    tamanho: '',
    vendidoMinimo: '',
    estoqueMinimo: '',
  })
  const response = data as any
  const dReal = response?.dados
  const d = PREVIEW_ESTOQUE ? ESTOQUE_MOCK : dReal
  const summary = d?.summary || {}
  const grupos: any[] = d?.grupos || []
  const linhas: any[] = useMemo(() => d?.linhas || [], [d?.linhas])
  const linhasFiltradas = useMemo(() => {
    const grupo = listaFilters.grupo.trim().toLowerCase()
    const produto = listaFilters.produto.trim().toLowerCase()
    const cor = listaFilters.cor.trim().toLowerCase()
    const tamanho = listaFilters.tamanho.trim().toLowerCase()
    const vendidoMinimo = Number(listaFilters.vendidoMinimo || 0)
    const estoqueMinimo = Number(listaFilters.estoqueMinimo || 0)

    return linhas.filter((item) => {
      const grupoTexto = String(item.grupo || '').toLowerCase()
      const produtoTexto = `${item.produto || ''} ${item.codigo || ''}`.toLowerCase()
      const corTexto = String(item.cor || '').toLowerCase()
      const tamanhoTexto = String(item.tamanho || '').toLowerCase()
      const vendidoHoje = Number(item.vendido_hoje || 0)
      const estoqueAtual = Number(item.estoque || 0)

      return (
        (!grupo || grupoTexto.includes(grupo)) &&
        (!produto || produtoTexto.includes(produto)) &&
        (!cor || corTexto.includes(cor)) &&
        (!tamanho || tamanhoTexto.includes(tamanho)) &&
        (!vendidoMinimo || vendidoHoje >= vendidoMinimo) &&
        (!estoqueMinimo || estoqueAtual >= estoqueMinimo)
      )
    })
  }, [linhas, listaFilters])

  // Suprime aviso de "CORES_BASE não usado" — preservado para futura expansão de mock.
  void CORES_BASE

  if (error && !PREVIEW_ESTOQUE) {
    return (
      <Panel title="Estoque indisponível" subtitle="O N8N retornou erro para este módulo.">
        <div className="p-6">
          <EmptyState title={error} detail="Execute a coleta D-1 e tente novamente." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Snapshot de estoque"
        title="Estoque por grupo"
        description="Posição ATUAL do estoque (snapshot — o Dapic não fornece histórico). A coluna Vendido reflete o intervalo selecionado."
        meta={<StatusPill tone="muted">Posição atual</StatusPill>}
      />

      {/* Seletor proprio (modo global, sincronizado com PeriodContext) */}
      <div className="mb-4">
        <DateRangePicker
          hidePresets
          showAtualizar
          onAtualizar={() => trigger.run()}
          atualizando={trigger.isBusy}
        />
      </div>

      {/* Status da coleta */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PREVIEW_ESTOQUE && (
          <StatusPill tone="orange">PREVIEW — dados simulados para visualização</StatusPill>
        )}
        {trigger.isBusy && <StatusPill tone="blue">Atualizando…</StatusPill>}
        {trigger.state === 'success' && <StatusPill tone="green">Atualizado!</StatusPill>}
        {trigger.state === 'timeout' && <StatusPill tone="red">Tempo esgotado</StatusPill>}
        {trigger.state === 'error' && <StatusPill tone="red">Falha ao iniciar coleta</StatusPill>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard
          label="Grupos"
          value={loading && !PREVIEW_ESTOQUE ? '...' : formatNum(summary.total_grupos || 0)}
          detail="famílias com produtos ativos"
          tone="orange"
        />
        <MetricCard
          label="Produtos"
          value={loading && !PREVIEW_ESTOQUE ? '...' : formatNum(summary.total_produtos || 0)}
          detail="SKUs com estoque"
          tone="blue"
        />
        <MetricCard
          label="Estoque (un.)"
          value={loading && !PREVIEW_ESTOQUE ? '...' : formatNum(summary.total_estoque || 0)}
          detail={`vendido no período: ${formatNum(summary.total_vendido_hoje || 0)}`}
          tone="green"
        />
        <MetricCard
          label="Valor a custo"
          value={loading && !PREVIEW_ESTOQUE ? '...' : formatBRL(summary.valor_custo_estoque || 0)}
          detail="capital empoçado em SKUs"
          tone="orange"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Panel
          title="Grupos / produtos"
          subtitle="Clique para expandir e ver as variações (cor + tamanho)"
        >
          <div className="p-3 sm:p-4">
            {loading && !PREVIEW_ESTOQUE ? <LoadingBlock /> : grupos.length > 0 ? (
              <div className="space-y-2">
                {grupos.map(grupo => {
                  const aberto = grupoExpandido === grupo.grupo
                  return (
                    <div
                      key={grupo.grupo}
                      className="hover-card-soft overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02]"
                    >
                      <button
                        onClick={() => setGrupoExpandido(aberto ? null : grupo.grupo)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.04] sm:flex-nowrap sm:gap-4 sm:px-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-extrabold text-[var(--text-primary)]">
                            {grupo.grupo}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {formatNum(grupo.total_produtos)} produto(s) · {formatNum(grupo.total_vendido_hoje)} vendido(s) no período
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-tight text-[var(--text-muted)]">Estoque</div>
                            <div className="whitespace-nowrap text-sm font-extrabold tabular-nums text-[var(--info)]">{formatNum(grupo.total_estoque)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-tight text-[var(--text-muted)]">Custo</div>
                            <div className="whitespace-nowrap text-sm font-extrabold tabular-nums text-[var(--accent)]">{formatBRL(grupo.valor_custo_estoque || 0)}</div>
                          </div>
                          <span className={`grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-transform ${aberto ? 'rotate-180' : ''}`}>
                            v
                          </span>
                        </div>
                      </button>

                      {aberto && (
                        <div className="border-t border-[var(--border)] px-3 py-3 sm:px-4">
                          {(grupo.produtos || []).map((produto: any) => (
                            <div key={produto.id_produto || produto.codigo} className="mb-4 last:mb-0">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 break-words text-sm font-bold text-[var(--text-primary)]">
                                    <span>{produto.produto}</span>
                                    {produto.no_top10 && (
                                      <span className="rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent)]">
                                        TOP 10
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-muted)]">SKU {produto.codigo}</div>
                                </div>
                                <div className="shrink-0 text-right text-[11px] text-[var(--text-muted)]">
                                  vendido: <span className="font-extrabold text-[var(--text-primary)]">{formatNum(produto.vendido_hoje)}</span>
                                  <span className="mx-1">|</span>
                                  estoque: <span className="font-extrabold text-[var(--info)]">{formatNum(produto.estoque_total)}</span>
                                </div>
                              </div>
                              <div className="mt-2 overflow-x-auto">
                                <table className="data-table min-w-full">
                                  <thead>
                                    <tr>
                                      <th>Cor</th>
                                      <th className="text-center whitespace-nowrap">Tam.</th>
                                      <th className="text-right whitespace-nowrap">Vendido</th>
                                      <th className="text-right whitespace-nowrap">Estoque</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(produto.variacoes || []).map((v: any, idx: number) => (
                                      <tr key={`${v.cor}-${v.tamanho}-${idx}`}>
                                        <td className="text-[var(--text-secondary)]">{v.cor || '-'}</td>
                                        <td className="text-center font-bold text-[var(--text-primary)] whitespace-nowrap">{v.tamanho || '-'}</td>
                                        <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatNum(v.vendido_hoje || 0)}</td>
                                        <td className="text-right font-bold text-[var(--info)] whitespace-nowrap">{formatNum(v.estoque || 0)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Sem dados de estoque"
                detail="Clique em Atualizar para coletar o snapshot."
              />
            )}
          </div>
        </Panel>
      </div>

      {linhas.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4">
          <Panel
            title="Lista plana (todas as variações)"
            subtitle={`${linhasFiltradas.length} de ${linhas.length} linhas · exportável para conferência operacional`}
          >
            <div className="max-h-[40rem] overflow-auto px-3 pb-4 sm:px-4">
              <table className="data-table min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th className="pt-4">Grupo</th>
                    <th className="pt-4">Produto</th>
                    <th className="pt-4">Cor</th>
                    <th className="pt-4 text-center whitespace-nowrap">Tam.</th>
                    <th className="pt-4 text-right whitespace-nowrap">Vendido</th>
                    <th className="pt-4 text-right whitespace-nowrap">Estoque</th>
                  </tr>
                  <tr className="[&>th]:sticky [&>th]:top-[41px] [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th>
                      <ColumnFilter
                        label="Filtrar grupo"
                        value={listaFilters.grupo}
                        onChange={(value) => setListaFilters(current => ({ ...current, grupo: value }))}
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Filtrar produto ou SKU"
                        value={listaFilters.produto}
                        onChange={(value) => setListaFilters(current => ({ ...current, produto: value }))}
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Filtrar cor"
                        value={listaFilters.cor}
                        onChange={(value) => setListaFilters(current => ({ ...current, cor: value }))}
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Tam."
                        value={listaFilters.tamanho}
                        onChange={(value) => setListaFilters(current => ({ ...current, tamanho: value }))}
                        align="center"
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Min."
                        value={listaFilters.vendidoMinimo}
                        onChange={(value) => setListaFilters(current => ({ ...current, vendidoMinimo: value }))}
                        type="number"
                        align="right"
                      />
                    </th>
                    <th>
                      <ColumnFilter
                        label="Min."
                        value={listaFilters.estoqueMinimo}
                        onChange={(value) => setListaFilters(current => ({ ...current, estoqueMinimo: value }))}
                        type="number"
                        align="right"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((item, index) => (
                    <tr key={`${item.codigo}-${item.cor}-${item.tamanho}-${index}`}>
                      <td className="break-words text-[var(--text-secondary)]">{item.grupo}</td>
                      <td>
                        <div className="break-words text-[var(--text-primary)]">{item.produto}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                      </td>
                      <td className="text-[var(--text-secondary)]">{item.cor}</td>
                      <td className="text-center font-bold text-[var(--text-primary)] whitespace-nowrap">{item.tamanho}</td>
                      <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatNum(item.vendido_hoje || 0)}</td>
                      <td className="text-right font-bold text-[var(--info)] whitespace-nowrap">{formatNum(item.estoque || 0)}</td>
                    </tr>
                  ))}
                  {linhasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState title="Nenhuma variação encontrada" detail="Ajuste os filtros para ampliar a busca." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
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
