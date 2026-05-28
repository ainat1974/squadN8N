import type { PeriodKey } from '../context/PeriodContext'

export function periodLabel(period: PeriodKey) {
  return period === '1d' ? 'Ontem + Hoje' : period
}

export function periodDays(period: PeriodKey) {
  if (period === '7d') return 7
  if (period === '1d') return 1
  if (period === '90d') return 90
  return 30
}

export function getReferenceDate(values: string[]) {
  const dates = values
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  return dates[0] || new Date()
}

export function filterByRecentDays<T>(
  items: T[],
  days: number,
  getDateValue: (item: T) => string | undefined | null,
) {
  const reference = getReferenceDate(items.map(item => getDateValue(item) || ''))
  const start = new Date(reference)
  start.setDate(reference.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)

  return items.filter(item => {
    const raw = getDateValue(item)
    if (!raw) return false
    const date = new Date(raw)
    return !Number.isNaN(date.getTime()) && date >= start && date <= reference
  })
}
