export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#f1f5f9]">Visão Geral Executiva</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard icon="💰" label="Receita do Mês" value="R$ —" trend={null} color="success" />
        <KPICard icon="📊" label="Saldo Líquido" value="R$ —" trend={null} color="accent" />
        <KPICard icon="📦" label="Estoque Crítico" value="— SKUs" trend={null} color="warning" />
        <KPICard icon="⚠️" label="Inadimplência" value="R$ —" trend={null} color="danger" />
      </div>

      {/* Placeholder para gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Evolução de Receita (30 dias)" />
        <ChartPlaceholder title="Fluxo de Caixa Projetado" />
      </div>

      {/* Alertas rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertPlaceholder title="🔴 Top 5 SKUs para Reposição" />
        <AlertPlaceholder title="⏰ Vencimentos Próximos (7 dias)" />
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, trend, color }: {
  icon: string; label: string; value: string; trend: number | null; color: string
}) {
  const colorMap: Record<string, string> = {
    success: 'text-[#22c55e]',
    accent:  'text-[#38bdf8]',
    warning: 'text-[#f59e0b]',
    danger:  'text-[#ef4444]',
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[#94a3b8] text-sm">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {trend !== null && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs. mês anterior
        </p>
      )}
    </div>
  )
}

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569] h-52 flex flex-col">
      <h3 className="text-sm font-medium text-[#94a3b8] mb-3">{title}</h3>
      <div className="flex-1 flex items-center justify-center text-[#475569] text-sm">
        Dados carregando...
      </div>
    </div>
  )
}

function AlertPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#475569]">
      <h3 className="text-sm font-medium text-[#94a3b8] mb-3">{title}</h3>
      <div className="text-[#475569] text-sm text-center py-6">Aguardando dados do ERP...</div>
    </div>
  )
}
