import { usePeriod, type DateRangePreset } from '../context/PeriodContext'
import { formatRangeLabel, MAX_RANGE_DAYS } from '../utils/dateRange'

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ultimos7', label: '7 dias' },
  { id: 'ultimos30', label: '30 dias' },
  { id: 'mesAtual', label: 'Este mês' },
  { id: 'mesAnterior', label: 'Mês anterior' },
]

type Props = {
  /** Exibe o botão Atualizar integrado (Visão Geral). */
  showAtualizar?: boolean
  onAtualizar?: () => void
  atualizando?: boolean
}

export default function DateRangePicker({ showAtualizar, onAtualizar, atualizando }: Props) {
  const { range, setRange, applyPreset } = usePeriod()

  return (
    <div className="date-range-picker rounded-xl border border-[var(--border)] bg-black/30 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Período de análise
          </p>
          <p className="m-0 mt-1 text-sm text-[var(--text-muted)]">
            {formatRangeLabel(range.dataInicial, range.dataFinal)}
            <span className="ml-2 text-[var(--text-muted)]">(máx. {MAX_RANGE_DAYS} dias)</span>
          </p>
        </div>

        <div className="flex w-full flex-wrap items-end gap-3 lg:w-auto">
          <label htmlFor="data-inicial" className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-[var(--text-secondary)] sm:flex-none">
            De
            <input
              id="data-inicial"
              name="dataInicial"
              type="date"
              className="date-input"
              value={range.dataInicial}
              max={range.dataFinal}
              onChange={e => setRange({ ...range, dataInicial: e.target.value })}
            />
          </label>
          <label htmlFor="data-final" className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-[var(--text-secondary)] sm:flex-none">
            Até
            <input
              id="data-final"
              name="dataFinal"
              type="date"
              className="date-input"
              value={range.dataFinal}
              min={range.dataInicial}
              onChange={e => setRange({ ...range, dataFinal: e.target.value })}
            />
          </label>
          {showAtualizar && onAtualizar && (
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className="action-button w-full px-4 text-xs font-bold disabled:opacity-60 sm:w-auto"
              title="Coleta o intervalo selecionado no ERP Dapic"
            >
              {atualizando ? 'Coletando…' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className="period-button px-3 text-xs font-bold"
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
