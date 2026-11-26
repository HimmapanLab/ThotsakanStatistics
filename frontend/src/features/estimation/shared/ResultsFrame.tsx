import type { ReactNode } from 'react'
import StatusBanner from '../../../components/StatusBanner'
import { useOnline } from '../../../hooks/useOnline'
import ExportMenu, { type ExportHandlers } from '../../../components/ExportMenu'
import FilterChip from '../../../components/lab/FilterChip'
import ResultsHead from '../../../components/lab/ResultsHead'
import { useData } from '../../../context/DataContext'
import './estimation.css'

/**
 * The frame of a Statistics page's results: the heading (with the export menu at the right), a quiet "Updating…"
 * line, an error with Retry, and the body. While a request runs the last result stays on screen, dimmed; the
 * area is never blank. Results are capped at 960 px (--results-max).
 */
export default function ResultsFrame({ title, n, updating, error, partialNotice, onRetry, exports, exportReady, exportReason, children }: {
  title: string
  n: number | null | undefined
  updating: boolean
  error: string | null
  /** Replaces "Previous result: the update failed." when an error leaves an older result on screen. */
  partialNotice?: string
  onRetry?: () => void
  exports?: ExportHandlers
  exportReady: boolean
  exportReason?: string
  children: ReactNode
}) {
  const { state } = useData()
  const online = useOnline()
  const sub = (
    <>
      {state.filename}{n != null ? ` · n = ${n.toLocaleString('en-US')}` : ''}
      {' '}<FilterChip />
    </>
  )
  return (
    <div className="est-results" data-updating={updating}>
      <ResultsHead title={title} sub={sub}>
        <ExportMenu handlers={exports} ready={exportReady} disabledReason={exportReason} />
      </ResultsHead>
      {updating && !online
        ? <StatusBanner isComputing={false} error={null} hasResult waiting />
        : <p className="est-updating" role="status" aria-live="polite">{updating ? 'Updating…' : ''}</p>}
      {error && (
        <div className="est-banner est-failed" role="alert">
          <strong>Couldn’t update results.</strong>{' '}
          <span>{partialNotice ?? 'The result below is the previous one.'}</span>
          <p className="est-failed-msg">{error}</p>
          {onRetry && <button type="button" className="lab-btn" onClick={onRetry}>Retry</button>}
        </div>
      )}
      <div className="est-body">{children}</div>
    </div>
  )
}

/** One titled block of results (a table or a plot). */
export function ResultsSection({ title, tag, actions, note, children }: {
  title: string
  tag?: ReactNode
  actions?: ReactNode
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="est-section">
      <div className="est-section-head"><h3>{title}</h3>{tag}{actions}</div>
      {note != null && <p className="est-note">{note}</p>}
      {children}
    </section>
  )
}

/** Warnings from the backend, directly under the table or plot they are about. */
export function Warnings({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="est-banner" aria-label="Warnings">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}
