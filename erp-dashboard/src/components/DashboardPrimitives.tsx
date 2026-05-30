import type { ReactNode } from 'react'

type Tone = 'orange' | 'green' | 'blue' | 'red' | 'muted'

const toneClass: Record<Tone, string> = {
  orange: 'text-[var(--accent)]',
  green: 'text-[var(--success)]',
  blue: 'text-[var(--info)]',
  red: 'text-[var(--danger)]',
  muted: 'text-[var(--text-muted)]',
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string
  title: string
  description: string
  meta?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta && <div className="page-header__meta">{meta}</div>}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'orange',
  compact = false,
}: {
  label: string
  value: string
  detail?: string | null
  tone?: Tone
  /** Usa fonte e padding reduzidos — bom para KPI strips com 4+ colunas. */
  compact?: boolean
}) {
  return (
    <div className={`metric-card${compact ? ' metric-card--compact' : ''}`}>
      <span>{label}</span>
      <strong className={toneClass[tone]}>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export function StatusPill({ children, tone = 'orange' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  )
}

export function LoadingBlock({ height = 'h-40' }: { height?: string }) {
  return <div className={`${height} loading-block`} />
}

export function ProgressBar({ value, max = 100, tone = 'orange' }: { value: number; max?: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="progress-track">
      <div className={`progress-fill progress-fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

