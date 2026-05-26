// ============================================================
// OverviewPage.tsx — Visão Geral Executiva com dados reais
// ============================================================
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate, formatNum } from '../services/api'
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
  const resumo = useErpData(api.resumo)
  const vendas = useErpData(api.vendas)
  const estoque = useErpData(api.estoque)
  const financeiro = useErpData(api.contasReceber)

  const d = resumo.data as any
  const atualizadoEm = d?.atualizadoEm ? formatDate(d.atualizadoEm) : null

  // Dados para gráfico de evolução de receita
  const evolucaoDiaria: any[] = (vendas.data as any)?.dados?.evolucao_diaria || []
  const chartLabels = evolucaoDiaria.map((e: any) =>
    new Date(e.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  )
  const chartReceita = evolucaoDiaria.map((e: any) => e.receita || 0)

  // Top SKUs para reposição
  const reposicao: any[] = (estoque.data as any)?.dados?.reposicao_urgente?.slice(0, 5) || []

  // Vencimentos próximos (CR recebendo em 7d + CP vencendo em 7d)
  const recebendo7d: any[] = (financeiro.data as any)?.dados?.recebendo_7d?.slice(0, 5) || []

  // Fluxo de caixa
  const fluxoCaixa = useErpData(api.fluxoCaixa)
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
        {atualizadoEm && (
          <span className="text-xs text-[#64748b]">Atualizado em {atualizadoEm}</span>
        )}
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
          value={isLoading ? '...' : formatBRL(d?.receita_total || 0)}
          sub={d ? `${formatNum(d.volume_vendas)} vendas` : null}
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
          value={isLoading ? '...' : `${formatNum(d?.skus_criticos || 0)} SKUs`}
          sub={d ? `${formatNum(d.skus_alerta || 0)} em alerta` : null}
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
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">📈 Evolução de Receita (últimos 7 dias)</h3>
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
        {/* Top 5 SKUs para Reposição */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">🔴 Top 5 SKUs para Reposição</h3>
          {estoque.loading ? <Skeleton /> : reposicao.length > 0 ? (
            <ul className="space-y-2">
              {reposicao.map((item: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-[#cbd5e1] truncate max-w-[60%]">{item.produto}</span>
                  <span className={`font-medium text-xs px-2 py-1 rounded-full ${
                    item.urgencia === 'CRITICO' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                    {item.dias_ate_zerar}d — {item.urgencia}
                  </span>
                </li>
              ))}
            </ul>
          ) : <EmptyList msg="Nenhum SKU crítico" />}
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
