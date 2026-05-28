export type BreakdownSlice = {
  data?: string
  summary?: {
    receita_total?: number
    volume_vendas?: number
    ticket_medio?: number
    total_itens?: number
  }
  atualizadoEm?: string | null
}

export type AcumuladoBreakdown = {
  ontem?: BreakdownSlice | null
  hoje?: BreakdownSlice | null
}

export function getBreakdown(source: { acumulado_breakdown?: AcumuladoBreakdown } | null | undefined) {
  return source?.acumulado_breakdown ?? null
}

/** Linha discreta "Ontem: R$ X + Hoje: R$ Y" para MetricCard.detail */
export function formatReceitaBreakdown(
  breakdown: AcumuladoBreakdown | null | undefined,
  formatBRL: (n: number) => string,
): string | null {
  if (!breakdown) return null
  const parts: string[] = []
  if (breakdown.ontem?.summary) {
    parts.push(`Ontem: ${formatBRL(Number(breakdown.ontem.summary.receita_total || 0))}`)
  }
  if (breakdown.hoje?.summary) {
    parts.push(`Hoje: ${formatBRL(Number(breakdown.hoje.summary.receita_total || 0))}`)
  }
  return parts.length ? parts.join(' + ') : null
}

export function formatVolumeBreakdown(
  breakdown: AcumuladoBreakdown | null | undefined,
  formatNum: (n: number) => string,
): string | null {
  if (!breakdown) return null
  const parts: string[] = []
  if (breakdown.ontem?.summary) {
    parts.push(`Ontem: ${formatNum(Number(breakdown.ontem.summary.volume_vendas || 0))}`)
  }
  if (breakdown.hoje?.summary) {
    parts.push(`Hoje: ${formatNum(Number(breakdown.hoje.summary.volume_vendas || 0))}`)
  }
  return parts.length ? parts.join(' + ') : null
}

export function hasAoVivo(breakdown: AcumuladoBreakdown | null | undefined) {
  return Boolean(breakdown?.hoje?.summary)
}
