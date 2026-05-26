// ============================================================
// OverviewPage.tsx — Visão Geral Executiva com dados reais
// ============================================================
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
import { usePeriod } from '../context/PeriodContext'
import { filterByRecentDays, periodDays, periodLabel } from '../utils/period'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler
)

export default function OverviewPage() {
  const { period } = usePeriod()
  const diasPeriodo = periodDays(period)
  const periodoLabel = periodLabel(period)
  const requestOptions = { periodo: period, dias: diasPeriodo }

  const resumo = useErpData(() => api.resumo(requestOptions), [period])
  const vendas = useErpData(() => api.vendas(requestOptions), [period])
  const estoque = useErpData(() => api.estoque(requestOptions), [period])
  const financeiro = useErpData(() => api.contasReceber(requestOptions), [period])
  const fluxoCaixa = useErpData(() => api.fluxoCaixa(requestOptions), [period])

  const d = resumo.data as any
  const atualizadoEm = d?.atualizadoEm ? formatDate(d.atualizadoEm) : null

  const evolucaoDiariaAll: any[] = (vendas.data as any)?.dados?.evolucao_diaria || []
  const evolucaoDiaria = filterByRecentDays(evolucaoDiariaAll, diasPeriodo, item => item.data)
  const receitaPeriodo = evolucaoDiaria.reduce((total: number, item: any) => total + Number(item.receita || 0), 0)
  const volumePeriodo = evolucaoDiaria.reduce((total: number, item: any) => total + Number(item.volume || 0), 0)

  const chartLabels = evolucaoDiaria.map((e: any, i: number) => {
    if (!e.data) return `Per.${i + 1}`
    const dt = new Date(e.data)
    return isNaN(dt.getTime()) ? e.data : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  })
  const chartReceita = evolucaoDiaria.map((e: any) => e.receita || 0)

  // ── Estoque: críticos, alerta e top 5 baixo estoque ───────
  const estoqueData = (estoque.data as any)?.dados
  const estoqueSummary = estoqueData?.summary || {}
  const reposicaoUrgente: any[] = estoqueData?.reposicao_urgente || []
  const saldoDia: any[] = estoqueData?.saldo_dia || []

  // Se não há reposicao_urgente com dados de velocidade, usa os 5 produtos
  // com menor estoque_atual como proxy de "atenção"
  const proxyBaixoEstoque: any[] = saldoDia
    .filter((item: any) => item.estoque_atual > 0)
    .sort((a: any, b: any) => a.estoque_atual - b.estoque_atual)
    .slice(0, 5)

  const reposicao = reposicaoUrgente.length > 0
    ? reposicaoUrgente.slice(0, 5)
    : proxyBaixoEstoque

  const usandoProxy = reposicaoUrgente.length === 0 && proxyBaixoEstoque.length > 0

  // ── Vencimentos próximos (CR) ──────────────────────────────
  const recebendo7d: any[] = (financeiro.data as any)?.dados?.recebendo_7d?.slice(0, 5) || []

  // ── Fluxo de caixa ─────────────────────────────────────────
  const projecao: any[] = (fluxoCaixa.data as any)?.dados?.projecao_4_semanas || []
  const fluxoLabels = projecao.map((p: any) => p.semana)
  const fluxoEntradas = projecao.map((p: any) => p.entradas_previstas)
  const fluxoSaidas = projecao.map((p: any) => p.saidas_previstas)

  const isLoading = resumo.loading || vendas.loading || estoque.loading
  const hasError = resumo.error && vendas.error

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#f1f5f9]">Visão Geral Executiva</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#38bdf8] font-medium bg-[#0f172a] border border-[#334155] px-2 py-1 rounded">
            Período: {periodoLabel}
          </span>
          {atualizadoEm && (
            <span className="text-xs text-[#64748b]">Atualizado em {atualizadoEm}</span>
          )}
        </div>
      </div>

      {hasError && (
        <div className="bg-[#7f1d1d] border border-[#ef4444] rounded-xl p-4 text-sm text-[#fca5a5]">
          ⚠️ Dados ainda não disponíveis. Execute o workflow N8N para coletar os dados do ERP.
          <br /><span className="text-xs opacity-70">Erro: {resumo.error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          icon="💰" label="Receita do Período"
          value={isLoading ? '...' : formatBRL(receitaPeriodo || d?.receita_total || 0)}
          sub={d || evolucaoDiaria.length > 0 ? `${formatNum(volumePeriodo || d?.volume_vendas || 0)} vendas · ${periodoLabel}` : null}
          color="success"
        />
        <KPICard
          icon="📊" label="Saldo Líquido CR/CP"
          value={isLoading ? '...' : formatBRL(d?.saldo_liquido || 0)}
          sub={d?.saldo_liquido >= 0 ? 'Positivo ✅' : 'Negativo ⚠️'}
          color={d?.saldo_liquido >= 0 ? 'accent' : 'warning'}
        />
        <KPICard
          icon="📦" label="Estoque Crítico"
          value={isLoading ? '...' : `${formatNum(estoqueSummary.skus_criticos || d?.skus_criticos || 0)} SKUs`}
          sub={
            isLoading ? null :
            (() => {
              const total = estoqueSummary.total_skus || saldoDia.length || 0
              const alerta = estoqueSummary.skus_alerta || d?.skus_alerta || 0
              const criticos = estoqueSummary.skus_criticos || d?.skus_criticos || 0
              if (total > 0 && criticos === 0) return `${formatNum(alerta)} em alerta · ${formatNum(total)} total`
              return `${formatNum(alerta)} em alerta · ${formatNum(total)} total`
            })()
          }
          color="warning"
        />
        <KPICard
          icon="⚠️" label="Inadimplência CR"
          value={isLoading ? '...' : formatBRL(d?.total_inadimplente || 0)}
          sub={d ? `Total CR: ${formatBRL(d.total_pendente_cr || 0)}` : null}
          color="danger"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução de Receita */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">
            📈 Evolução de Receita ({periodoLabel})
          </h3>
          {vendas.loading ? (
            <Skeleton height="h-40" />
          ) : evolucaoDiaria.length > 0 ? (
            <Line
              data={{
                labels: chartLabels,
                datasets: [{
                  label: 'Receita (R$)',
                  data: chartReceita,
                  borderColor: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 3,
                }]
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#1e293b' } },
                  y: { ticks: { color: '#64748b', font: { size: 11 }, callback: (v: any) => `R$ ${(v/1000).toFixed(0)}k` }, grid: { color: '#334155' } }
                }
              }}
            />
          ) : <EmptyChart msg="Sem dados de vendas" />}
        </div>

        {/* Fluxo de Caixa */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">💸 Fluxo de Caixa (próximas 4 semanas)</h3>
          {fluxoCaixa.loading ? (
            <Skeleton height="h-40" />
          ) : projecao.length > 0 ? (
            <Bar
              data={{
                labels: fluxoLabels,
                datasets: [
                  { label: 'Entradas', data: fluxoEntradas, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
                  { label: 'Saídas', data: fluxoSaidas, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
                ]
              }}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
                scales: {
                  x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#334155' } },
                  y: { ticks: { color: '#64748b', font: { size: 11 }, callback: (v: any) => `R$${(v/1000).toFixed(0)}k` }, grid: { color: '#334155' } }
                }
              }}
            />
          ) : <EmptyChart msg="Sem dados financeiros" />}
        </div>
      </div>

      {/* Alertas Rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 SKUs para Reposição / Menor Estoque */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-1">
            {usandoProxy ? '⚠️ Top 5 SKUs com Menor Estoque' : '🔴 Top 5 SKUs para Reposição'}
          </h3>
          {usandoProxy && (
            <p className="text-xs text-[#64748b] mb-3">
              Análise de velocidade indisponível — exibindo produtos com menor saldo atual
            </p>
          )}
          {estoque.loading ? <Skeleton /> : reposicao.length > 0 ? (
            <ul className="space-y-2">
              {reposicao.map((item: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-[#cbd5e1] truncate max-w-[60%]">
                    {item.produto || item.descricao || 'Produto ' + (i + 1)}
                  </span>
                  {usandoProxy ? (
                    <span className="font-medium text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-300">
                      {formatNum(item.estoque_atual)} un
                    </span>
                  ) : (
                    <span className={`font-medium text-xs px-2 py-1 rounded-full ${
                      item.urgencia === 'CRITICO' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {item.dias_ate_zerar}d — {item.urgencia}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <EmptyList msg="Nenhum dado de estoque disponível" />}
        </div>

        {/* Vencimentos em 7 dias */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">⏰ CR — Recebendo nos Próximos 7 Dias</h3>
          {financeiro.loading ? <Skeleton /> : recebendo7d.length > 0 ? (
            <ul className="space-y-2">
              {recebendo7d.map((item: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-[#cbd5e1] truncate max-w-[55%]">{item.cliente || 'N/A'}</span>
                  <span className="text-[#22c55e] font-medium">{formatBRL(item.valor)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyList msg="Nenhum recebimento em 7 dias" />}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string | null; color: string
}) {
  const colorMap: Record<string, string> = {
    success: 'text-[#22c55e]', accent: 'text-[#38bdf8]',
    warning: 'text-[#f59e0b]', danger: 'text-[#ef4444]',
  }
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[#94a3b8] text-sm">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-[#64748b] mt-1">{sub}</p>}
    </div>
  )
}

function Skeleton({ height = 'h-24' }: { height?: string }) {
  return <div className={`${height} bg-[#334155] rounded-lg animate-pulse`} />
}

function EmptyChart({ msg }: { msg: string }) {
  return <div className="h-40 flex items-center justify-center text-[#475569] text-sm">{msg}</div>
}

function EmptyList({ msg }: { msg: string }) {
  return <div className="text-[#475569] text-sm text-center py-6">{msg}</div>
}
