// ============================================================
// StockPage.tsx — Gestão de Estoque com dados reais
// ============================================================
import { useErpData } from '../hooks/useErpData'
import { api, formatNum } from '../services/api'

export default function StockPage() {
  const { data, loading, error, refresh } = useErpData(api.estoque)
  const d = (data as any)?.dados

  const summary = d?.summary || {}
  const reposicao: any[] = d?.reposicao_urgente || []
  const tendencia: any[] = d?.tendencia_semanal?.slice(0, 10) || []
  const allSaldoDia: any[] = d?.saldo_dia || []
  const totalSkus = summary.total_skus || allSaldoDia.length

  if (error) return (
    <div className="bg-[#7f1d1d] border border-[#ef4444] rounded-xl p-6 text-center">
      <p className="text-[#fca5a5] mb-3">⚠️ {error}</p>
      <button onClick={refresh} className="text-sm text-white bg-red-700 px-4 py-2 rounded-lg">Tentar novamente</button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#f1f5f9]">Gestão de Estoque</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <p className="text-[#94a3b8] text-sm mb-1">📦 SKUs Críticos</p>
          <p className="text-3xl font-bold text-[#ef4444]">{loading ? '...' : formatNum(summary.skus_criticos || 0)}</p>
          <p className="text-xs text-[#64748b] mt-1">≤ 7 dias de estoque</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <p className="text-[#94a3b8] text-sm mb-1">⚠️ SKUs em Alerta</p>
          <p className="text-3xl font-bold text-[#f59e0b]">{loading ? '...' : formatNum(summary.skus_alerta || 0)}</p>
          <p className="text-xs text-[#64748b] mt-1">8–15 dias de estoque</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <p className="text-[#94a3b8] text-sm mb-1">🏭 Total em Estoque</p>
          <p className="text-3xl font-bold text-[#22c55e]">{loading ? '...' : formatNum(totalSkus)}</p>
          <p className="text-xs text-[#64748b] mt-1">produtos cadastrados</p>
        </div>
      </div>

      {/* Reposição Urgente */}
      <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
        <h3 className="text-sm font-medium text-[#94a3b8] mb-4">🔴 Produtos para Reposição Urgente</h3>
        {loading ? <div className="h-40 bg-[#334155] rounded animate-pulse" /> : reposicao.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#64748b] border-b border-[#334155]">
                  <th className="text-left py-2 pr-4">Produto</th>
                  <th className="text-right py-2 pr-4">Estoque Atual</th>
                  <th className="text-right py-2 pr-4">Venda/Dia</th>
                  <th className="text-right py-2 pr-4">Dias Restantes</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {reposicao.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-[#1e293b] hover:bg-[#243447]">
                    <td className="py-2 pr-4 text-[#cbd5e1] max-w-[200px] truncate">{item.produto}</td>
                    <td className="py-2 pr-4 text-right text-[#94a3b8]">{formatNum(item.estoque_atual)}</td>
                    <td className="py-2 pr-4 text-right text-[#94a3b8]">{formatNum(item.venda_media_diaria, 1)}/dia</td>
                    <td className={`py-2 pr-4 text-right font-bold ${item.dias_ate_zerar <= 7 ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`}>
                      {item.dias_ate_zerar}d
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.urgencia === 'CRITICO' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                      }`}>{item.urgencia}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-center text-[#475569] py-8">✅ Nenhum produto em situação crítica</div>}
      </div>

      {/* Tendência Semanal */}
      <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
        <h3 className="text-sm font-medium text-[#94a3b8] mb-4">📊 Tendência Semanal — Top 10 Produtos</h3>
        {loading ? <div className="h-40 bg-[#334155] rounded animate-pulse" /> : tendencia.length > 0 ? (
          <div className="space-y-2">
            {tendencia.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-[#cbd5e1] flex-1 truncate">{item.produto}</span>
                <span className="text-[#64748b] w-20 text-right">{formatNum(item.vendas_semana_atual)} un</span>
                <span className={`w-16 text-right font-medium ${
                  item.variacao_pct > 5 ? 'text-[#22c55e]' : item.variacao_pct < -5 ? 'text-[#ef4444]' : 'text-[#94a3b8]'
                }`}>
                  {item.variacao_pct > 0 ? '▲' : item.variacao_pct < 0 ? '▼' : '—'} {Math.abs(item.variacao_pct).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ) : <div className="text-center text-[#475569] py-8">Sem dados de tendência semanal</div>}
      </div>
    </div>
  )
}
