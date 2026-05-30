const TZ = 'America/Sao_Paulo'

export const MAX_RANGE_DAYS = 90

export type DateRange = {
  dataInicial: string
  dataFinal: string
}

export type DateRangePreset = 'hoje' | 'ultimos7' | 'ultimos30' | 'mesAtual' | 'mesAnterior'

export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysInRange(dataInicial: string, dataFinal: string): number {
  const start = parseIso(dataInicial)
  const end = parseIso(dataFinal)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, diff + 1)
}

export function clampRange(range: DateRange): DateRange {
  let { dataInicial, dataFinal } = range
  if (dataInicial > dataFinal) {
    [dataInicial, dataFinal] = [dataFinal, dataInicial]
  }
  if (daysInRange(dataInicial, dataFinal) > MAX_RANGE_DAYS) {
    dataInicial = addDays(dataFinal, -(MAX_RANGE_DAYS - 1))
  }
  return { dataInicial, dataFinal }
}

export function presetToRange(preset: DateRangePreset): DateRange {
  const hoje = todayInSaoPaulo()
  const [y, m] = hoje.split('-').map(Number)
  const firstOfMonth = `${y}-${String(m).padStart(2, '0')}-01`
  const lastOfPrevMonth = addDays(firstOfMonth, -1)
  const [py, pm] = lastOfPrevMonth.split('-').map(Number)
  const firstOfPrevMonth = `${py}-${String(pm).padStart(2, '0')}-01`

  switch (preset) {
    case 'hoje':
      return { dataInicial: hoje, dataFinal: hoje }
    case 'ultimos7':
      return { dataInicial: addDays(hoje, -6), dataFinal: hoje }
    case 'ultimos30':
      return { dataInicial: addDays(hoje, -29), dataFinal: hoje }
    case 'mesAtual':
      return { dataInicial: firstOfMonth, dataFinal: hoje }
    case 'mesAnterior':
      return { dataInicial: firstOfPrevMonth, dataFinal: lastOfPrevMonth }
    default:
      return { dataInicial: hoje, dataFinal: hoje }
  }
}

export function formatRangeLabel(dataInicial: string, dataFinal: string): string {
  const fmt = (iso: string) => {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
  }
  if (dataInicial === dataFinal) return fmt(dataInicial)
  return `${fmt(dataInicial)} → ${fmt(dataFinal)}`
}
