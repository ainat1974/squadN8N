import { useState } from 'react'
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatNum } from '../services/api'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'

export default function StockPage() {
  const { data, loading, error, refresh } = useErpData(api.estoque)
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null)
  const response = data as any
  const d = response?.dados
  const summary = d?.summary || {}
  const grupos: any[] = d?.grupos || []
  const linhas: any[] = d?.linhas || []

  if (error) {
    return (
      <Panel title="Estoque indisponivel" subtitle="O N8N retornou erro para este modulo.">
        <div className="p-6">
          <EmptyState title={error} detail="Execute a coleta D-1 e tente novamente." />
          <button onClick={refresh} className="action-button mt-4 px-4 text-sm font-bold">Tentar novamente</button>
        </div>
      </Panel>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        eyebrow="Snapshot de estoque"
        title="Estoque dos grupos do Top 10"
        description="Estoque atual dos produtos vendidos hoje cujos grupos contem ao menos um item do top 10 mais vendido. Permite ver, por familia, o saldo disponivel x venda do dia."
        meta={<StatusPill tone="muted">Snapshot D-1</StatusPill>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Grupos"
          value={loading ? '...' : formatNum(summary.total_grupos || 0)}
          detail="familias dos top 10"
          tone="orange"
        />
        <MetricCard
          label="Produtos"
          value={loading ? '...' : formatNum(summary.total_produtos || 0)}
          detail="vendidos no D-1"
          tone="blue"
        />
        <MetricCard
          label="Estoque (un.)"
          value={loading ? '...' : formatNum(summary.total_estoque || 0)}
          detail={`vendido hoje: ${formatNum(summary.total_vendido_hoje || 0)}`}
          tone="green"
        />
        <MetricCard
          label="Valor custo"
          value={loading ? '...' : formatBRL(summary.valor_custo_estoque || 0)}
          detail="estoque a custo"
          tone="orange"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Panel
          title="Grupos do Top 10"
          subtitle="Clique para expandir e ver as variacoes (cor + tamanho)"
        >
          <div className="p-4">
            {loading ? <LoadingBlock /> : grupos.length > 0 ? (
              <div className="space-y-2">
                {grupos.map(grupo => {
                  const aberto = grupoExpandido === grupo.grupo
                  return (
                    <div
                      key={grupo.grupo}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02]"
                    >
                      <button
                        onClick={() => setGrupoExpandido(aberto ? null : grupo.grupo)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                            {grupo.grupo}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {formatNum(grupo.total_produtos)} produto(s) - {formatNum(grupo.total_vendido_hoje)} vendido(s) hoje
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-right">
                            <div className="text-[11px] uppercase tracking-tight text-[var(--text-muted)]">Estoque</div>
                            <div className="text-sm font-extrabold text-[var(--info)]">{formatNum(grupo.total_estoque)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] uppercase tracking-tight text-[var(--text-muted)]">Custo</div>
                            <div className="text-sm font-extrabold text-[var(--accent)]">{formatBRL(grupo.valor_custo_estoque || 0)}</div>
                          </div>
                          <span className={`grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-transform ${aberto ? 'rotate-180' : ''}`}>
                            v
                          </span>
                        </div>
                      </button>

                      {aberto && (
                        <div className="border-t border-[var(--border)] px-4 py-3">
                          {(grupo.produtos || []).map((produto: any) => (
                            <div key={produto.id_produto || produto.codigo} className="mb-3 last:mb-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                                    {produto.produto}
                                    {produto.no_top10 && (
                                      <span className="ml-2 rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent)]">
                                        TOP 10
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-muted)]">SKU {produto.codigo}</div>
                                </div>
                                <div className="text-right text-[11px] text-[var(--text-muted)]">
                                  vendido: <span className="font-extrabold text-[var(--text-primary)]">{formatNum(produto.vendido_hoje)}</span>
                                  <span className="mx-1">|</span>
                                  estoque: <span className="font-extrabold text-[var(--info)]">{formatNum(produto.estoque_total)}</span>
                                </div>
                              </div>
                              <table className="data-table mt-2">
                                <thead>
                                  <tr>
                                    <th>Cor</th>
                                    <th className="text-center">Tamanho</th>
                                    <th className="text-right">Vendido hoje</th>
                                    <th className="text-right">Estoque</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(produto.variacoes || []).map((v: any, idx: number) => (
                                    <tr key={`${v.cor}-${v.tamanho}-${idx}`}>
                                      <td className="text-[var(--text-secondary)]">{v.cor || '-'}</td>
                                      <td className="text-center font-bold text-[var(--text-primary)]">{v.tamanho || '-'}</td>
                                      <td className="text-right text-[var(--text-secondary)]">{formatNum(v.vendido_hoje || 0)}</td>
                                      <td className="text-right font-bold text-[var(--info)]">{formatNum(v.estoque || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
                detail="Execute a coleta para popular os grupos do top 10."
              />
            )}
          </div>
        </Panel>
      </div>

      {linhas.length > 0 && !loading && (
        <div className="mt-4 grid grid-cols-1 gap-4">
          <Panel
            title="Lista plana (todas as variacoes)"
            subtitle={`${linhas.length} linhas - exportavel para conferencia operacional`}
          >
            <div className="max-h-[40rem] overflow-y-auto px-4 pb-4">
              <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--bg-panel)] [&>th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
                    <th className="pt-4">Grupo</th>
                    <th className="pt-4">Produto</th>
                    <th className="pt-4">Cor</th>
                    <th className="pt-4 text-center">Tam.</th>
                    <th className="pt-4 text-right">Vendido</th>
                    <th className="pt-4 text-right">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((item, index) => (
                    <tr key={`${item.codigo}-${item.cor}-${item.tamanho}-${index}`}>
                      <td className="max-w-[200px] truncate text-[var(--text-secondary)]">{item.grupo}</td>
                      <td className="max-w-[260px]">
                        <div className="truncate text-[var(--text-primary)]">{item.produto}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">SKU {item.codigo}</div>
                      </td>
                      <td className="text-[var(--text-secondary)]">{item.cor}</td>
                      <td className="text-center font-bold text-[var(--text-primary)]">{item.tamanho}</td>
                      <td className="text-right text-[var(--text-secondary)]">{formatNum(item.vendido_hoje || 0)}</td>
                      <td className="text-right font-bold text-[var(--info)]">{formatNum(item.estoque || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
