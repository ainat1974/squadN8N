import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatNum } from '../services/api'
import { EmptyState, LoadingBlock, MetricCard, PageHeader, Panel, ProgressBar, StatusPill } from '../components/DashboardPrimitives'

export default function StockPage() {
  const { data, loading, error, refresh } = useErpData(api.estoque)
  const response = data as any
  const d = response?.dados
  const summary = d?.summary || {}
  const saldoDia: any[] = d?.saldo_dia || []
  const reposicao: any[] = d?.reposicao_urgente || []
  const totalSkus = summary.total_skus || saldoDia.length
  const menoresSaldos = saldoDia
    .filter(item => Number(item.estoque_atual || 0) >= 0)
    .sort((a, b) => Number(a.estoque_atual || 0) - Number(b.estoque_atual || 0))
    .slice(0, 12)

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
        title="Estoque operacional"
        description="A posicao de estoque e um retrato da ultima coleta. Indicadores de giro podem ficar indisponiveis quando a Dapic retorna somente movimentacoes do D-1."
        meta={<StatusPill tone="muted">Snapshot D-1</StatusPill>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="SKUs monitorados" value={loading ? '...' : formatNum(totalSkus || 0)} detail="produtos com saldo" tone="orange" />
        <MetricCard label="Criticos" value={loading ? '...' : formatNum(summary.skus_criticos || 0)} detail="ate 7 dias" tone="red" />
        <MetricCard label="Em alerta" value={loading ? '...' : formatNum(summary.skus_alerta || 0)} detail="8 a 15 dias" tone="blue" />
        <MetricCard label="Valor estoque" value={loading ? '...' : formatBRL(summary.valor_total_estoque || 0)} detail="quando informado pela API" tone="green" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Menores saldos" subtitle="Produtos que merecem conferencia operacional">
          <div className="p-4">
            {loading ? <LoadingBlock /> : menoresSaldos.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Produto</th><th className="text-right">Saldo</th><th>Pressao</th></tr></thead>
                <tbody>
                  {menoresSaldos.map((item, index) => {
                    const saldo = Number(item.estoque_atual || 0)
                    return (
                      <tr key={`${item.codigo}-${index}`}>
                        <td className="max-w-[360px] truncate">{item.produto}</td>
                        <td className="text-right font-bold text-[var(--accent)]">{formatNum(saldo)}</td>
                        <td className="min-w-[120px]"><ProgressBar value={Math.max(0, 20 - saldo)} max={20} tone={saldo <= 2 ? 'red' : 'orange'} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : <EmptyState title="Sem saldos demonstraveis" detail="A coleta de estoque nao retornou itens para listar." />}
          </div>
        </Panel>

        <Panel title="Reposicao calculada" subtitle="Disponivel quando ha velocidade media confiavel">
          <div className="p-4">
            {loading ? <LoadingBlock /> : reposicao.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Produto</th><th className="text-right">Venda/dia</th><th className="text-right">Dias</th></tr></thead>
                <tbody>
                  {reposicao.slice(0, 10).map((item, index) => (
                    <tr key={`${item.codigo}-${index}`}>
                      <td className="max-w-[360px] truncate">{item.produto}</td>
                      <td className="text-right">{formatNum(item.venda_media_diaria || 0, 1)}</td>
                      <td className="text-right font-bold text-[var(--danger)]">{formatNum(item.dias_ate_zerar || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="Reposicao sem base historica suficiente"
                detail="Como a coleta foi reestruturada para D-1, este quadro aparece quando nao ha movimentacao suficiente para calcular venda media."
              />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

