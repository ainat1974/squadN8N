// ============================================================
// SalesPage.tsx — Página de Vendas com dados reais
// ============================================================
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatNum } from '../services/api'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement)

export default function SalesPage() {
  const { data, loading, error, refresh } = useErpData(api.vendas)
  const d = (data as any)?.dados

  const summary = d?.summary || {}
  const evolucao: any[] = d?.evolucao_diaria || []
  const topProdutos: any[] = d?.top_produtos?.slice(0, 10) || []
  const topClientes: any[] = d?.top_clientes?.slice(0, 5) || []

  const chartLabels = evolucao.map((e: any, i: number) => {
    if (!e.data) return `Período ${i + 1}`
    const d = new Date(e.data)
    return isNaN(d.getTime()) ? e.data : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  })

  const doughnutData = (summary.receita_b2b > 0 || summary.receita_pdv > 0) ? {
    labels: ['PDV', 'B2B'],
    datasets: [{
      data: [summary.receita_pdv || 0, summary.receita_b2b || 0],
      backgroundColor: ['#38bdf8', '#22c55e'],
      borderWidth: 0,
    }]
  } : null

  if (error) return <ErrorCard msg={error} onRetry={refresh} />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#f1f5f9]">Análise de Vendas</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Receita Total" value={loading ? '...' : formatBRL(summary.receita_total || 0)} icon="💰" />
        <StatCard label="Volume de Vendas" value={loading ? '...' : `${formatNum(summary.volume_vendas || 0)} pedidos`} icon="🛒" />
        <StatCard label="Ticket Médio" value={loading ? '...' : formatBRL(summary.ticket_medio || 0)} icon="📊" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">📈 Evolução de Receita Diária</h3>
          {loading ? <Skeleton height="h-52" /> : evolucao.length > 0 ? (
            <Bar
              data={{
                labels: chartLabels,
                datasets: [{ label: 'Receita (R$)', data: evolucao.map((e: any) => e.receita), backgroundColor: 'rgba(56,189,248,0.7)', borderRadius: 4 }]
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#334155' } },
                  y: { ticks: { color: '#64748b', callback: (v: any) => `R$${(v/1000).toFixed(0)}k` }, grid: { color: '#334155' } }
                }
              }}
            />
          ) : <Empty msg="Sem dados de evolução" />}
        </div>

        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569] flex flex-col items-center">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4 self-start">🥧 PDV vs B2B</h3>
          {loading ? <Skeleton height="h-36" /> : doughnutData ? (
            <>
              <Doughnut data={doughnutData} options={{ plugins: { legend: { labels: { color: '#94a3b8' } } }, cutout: '65%' }} />
              <div className="mt-3 text-center text-xs text-[#64748b]">
                <div>PDV: <span className="text-[#38bdf8] font-medium">{formatBRL(summary.receita_pdv || 0)}</span></div>
                <div>B2B: <span className="text-[#22c55e] font-medium">{formatBRL(summary.receita_b2b || 0)}</span></div>
              </div>
            </>
          ) : <Empty msg="Sem breakdown disponível" />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">🏆 Top 10 Produtos por Receita</h3>
          {loading ? <Skeleton /> : topProdutos.length > 0 ? (
            <ul className="space-y-2">
              {topProdutos.map((p: any, i: number) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-[#64748b] w-5 text-right">{i + 1}.</span>
                  <span className="text-[#cbd5e1] flex-1 truncate">{p.produto}</span>
                  <span className="text-[#22c55e] font-medium whitespace-nowrap">{formatBRL(p.receita)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty msg="Sem dados de produtos" />}
        </div>

        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-4">👥 Top 5 Clientes B2B</h3>
          {loading ? <Skeleton /> : topClientes.length > 0 ? (
            <ul className="space-y-3">
              {topClientes.map((c: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-[#cbd5e1]">{c.cliente}</p>
                    <p className="text-[#64748b] text-xs">{formatNum(c.volume)} pedidos</p>
                  </div>
                  <span className="text-[#38bdf8] font-medium">{formatBRL(c.receita)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty msg="Sem dados de clientes B2B" />}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
      <div className="flex items-center gap-2 mb-2"><span>{icon}</span><span className="text-[#94a3b8] text-sm">{label}</span></div>
      <p className="text-2xl font-bold text-[#f1f5f9]">{value}</p>
    </div>
  )
}
function Skeleton({ height = 'h-24' }: { height?: string }) {
  return <div className={`${height} bg-[#334155] rounded-lg animate-pulse`} />
}
function Empty({ msg }: { msg: string }) {
  return <div className="h-32 flex items-center justify-center text-[#475569] text-sm">{msg}</div>
}
function ErrorCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="bg-[#7f1d1d] border border-[#ef4444] rounded-xl p-6 text-center">
      <p className="text-[#fca5a5] mb-3">⚠️ {msg}</p>
      <button onClick={onRetry} className="text-sm text-white bg-red-700 px-4 py-2 rounded-lg hover:bg-red-600">Tentar novamente</button>
    </div>
  )
}
