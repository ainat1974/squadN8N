// ============================================================
// FinancialPage.tsx — Contas a Pagar/Receber com dados reais
// ============================================================
import { useErpData } from '../hooks/useErpData'
import { api, formatBRL, formatDate } from '../services/api'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function FinancialPage() {
  const cp = useErpData(api.contasPagar)
  const cr = useErpData(api.contasReceber)
  const fc = useErpData(api.fluxoCaixa)

  const cpData = (cp.data as any)?.dados
  const crData = (cr.data as any)?.dados
  const fcData = (fc.data as any)?.dados

  const projecao: any[] = fcData?.projecao_4_semanas || []

  const loading = cp.loading || cr.loading || fc.loading

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#f1f5f9]">Contas a Pagar e Receber</h1>

      {/* KPIs CP/CR */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI label="CP — Total Pendente" value={cp.loading ? '...' : formatBRL(cpData?.summary?.total_pendente || 0)} color="text-[#f59e0b]" icon="💸" />
        <KPI label="CP — Vencido" value={cp.loading ? '...' : formatBRL(cpData?.summary?.total_vencido || 0)} color="text-[#ef4444]" icon="🔴" />
        <KPI label="CR — Total Pendente" value={cr.loading ? '...' : formatBRL(crData?.summary?.total_pendente || 0)} color="text-[#38bdf8]" icon="💰" />
        <KPI label="CR — Inadimplente" value={cr.loading ? '...' : formatBRL(crData?.summary?.total_inadimplente || 0)} color="text-[#ef4444]" icon="⚠️" />
      </div>

      {/* Saldo líquido destaque */}
      {!cr.loading && crData && (
        <div className={`rounded-xl p-4 border text-center ${
          (crData.summary?.saldo_liquido || 0) >= 0
            ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'
        }`}>
          <p className="text-[#94a3b8] text-sm">Saldo Líquido (CR − CP)</p>
          <p className={`text-3xl font-bold mt-1 ${(crData.summary?.saldo_liquido || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatBRL(crData.summary?.saldo_liquido || 0)}
          </p>
        </div>
      )}

      {/* Fluxo de Caixa */}
      <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
        <h3 className="text-sm font-medium text-[#94a3b8] mb-4">💸 Projeção de Fluxo de Caixa (4 semanas)</h3>
        {fc.loading ? <div className="h-48 bg-[#334155] rounded animate-pulse" /> : projecao.length > 0 ? (
          <>
            <Bar
              data={{
                labels: projecao.map((p: any) => p.semana),
                datasets: [
                  { label: 'Entradas', data: projecao.map((p: any) => p.entradas_previstas), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
                  { label: 'Saídas', data: projecao.map((p: any) => p.saidas_previstas), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
                ]
              }}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                  x: { ticks: { color: '#64748b' }, grid: { color: '#334155' } },
                  y: { ticks: { color: '#64748b', callback: (v: any) => `R$${(v/1000).toFixed(0)}k` }, grid: { color: '#334155' } }
                }
              }}
            />
            <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-center">
              {projecao.map((p: any, i: number) => (
                <div key={i} className={`rounded-lg p-2 ${p.saldo_semana >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <p className="text-[#64748b]">{p.semana}</p>
                  <p className={`font-bold mt-1 ${p.saldo_semana >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {formatBRL(p.saldo_semana)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : <div className="text-center text-[#475569] py-8">Sem dados de fluxo de caixa</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CP Vencidos */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#f59e0b] mb-4">💸 CP — Contas Vencidas</h3>
          {loading ? <div className="h-32 bg-[#334155] rounded animate-pulse" /> :
            (cpData?.vencidos?.length > 0) ? (
              <ul className="space-y-2">
                {cpData.vencidos.slice(0, 8).map((item: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#cbd5e1] truncate">{item.descricao}</p>
                      <p className="text-[#ef4444] text-xs">{item.dias_atraso}d de atraso</p>
                    </div>
                    <span className="text-[#f59e0b] font-medium ml-3 whitespace-nowrap">{formatBRL(item.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[#475569] text-sm text-center py-4">✅ Nenhuma conta vencida</p>
          }
        </div>

        {/* CR Inadimplentes */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
          <h3 className="text-sm font-medium text-[#ef4444] mb-4">⚠️ CR — Inadimplentes</h3>
          {loading ? <div className="h-32 bg-[#334155] rounded animate-pulse" /> :
            (crData?.inadimplentes?.length > 0) ? (
              <ul className="space-y-2">
                {crData.inadimplentes.slice(0, 8).map((item: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#cbd5e1] truncate">{item.cliente}</p>
                      <p className="text-[#94a3b8] text-xs">Venc: {formatDate(item.data_vencimento)} · {item.dias_atraso}d</p>
                    </div>
                    <span className="text-[#ef4444] font-medium ml-3 whitespace-nowrap">{formatBRL(item.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[#475569] text-sm text-center py-4">✅ Nenhum inadimplente</p>
          }
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
      <div className="flex items-center gap-2 mb-2"><span>{icon}</span><span className="text-[#94a3b8] text-xs">{label}</span></div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
