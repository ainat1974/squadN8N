import type { DateRange } from './dateRange'
import { daysInRange, formatRangeLabel } from './dateRange'

export { formatRangeLabel }

export function buildApiOptions(range: DateRange) {
  const dias = daysInRange(range.dataInicial, range.dataFinal)
  return {
    dataInicial: range.dataInicial,
    dataFinal: range.dataFinal,
    dias,
  }
}
