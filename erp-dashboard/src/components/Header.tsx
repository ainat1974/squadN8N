import { useState } from 'react'
import { usePeriod } from '../context/PeriodContext'
import type { PeriodKey } from '../context/PeriodContext'

const periods: PeriodKey[] = ['7d', '30d', '90d', 'Personalizado']

export default function Header() {
  const { period, setPeriod } = usePeriod()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    if (!webhookUrl) return

    setRefreshing(true)
    try {
      await fetch(webhookUrl, { method: 'POST' })
    } catch {
      // silently fail — N8N will retry
    } finally {
      setTimeout(() => setRefreshing(false), 2000)
    }
  }

  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <header className="h-14 bg-[#1e293b] border-b border-[#475569] flex items-center px-6 gap-4 shrink-0">
      <span className="text-[#94a3b8] text-xs">Atualizado em {now}</span>

      <div className="flex items-center gap-1 ml-auto">
        {periods.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              period === p
                ? 'bg-[#38bdf8] text-[#0f172a]'
                : 'text-[#94a3b8] hover:bg-[#334155]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-[#f1f5f9] text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
        {refreshing ? 'Atualizando...' : 'Atualizar'}
      </button>
    </header>
  )
}
