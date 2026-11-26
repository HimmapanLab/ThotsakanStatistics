import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePlotHeight } from '../../../components/lab'
import StatusBanner from '../../../components/StatusBanner'
import { useOnline } from '../../../hooks/useOnline'
import './hp.css'

/**
 * Small building blocks for the Hypothesis Testing and Probability pages: the results wrapper, a titled block,
 * the three-rule table, a plot frame and the ƒ placement helpers. Styles are in hp.css.
 */

/**
 * The results column: at most 960 px wide. While the next result loads (`updating`) the last one stays on
 * screen, dimmed, under a quiet line that says so, and a screen reader hears the same.
 */
export function Out({ updating = false, children }: { updating?: boolean; children: ReactNode }) {
  const online = useOnline()
  return (
    <div className={`hp-out${updating ? ' is-updating' : ''}`} aria-busy={updating}>
      {updating && !online
        ? <StatusBanner isComputing={false} error={null} hasResult waiting />
        : <p className="hp-updating" role="status" aria-live="polite">{updating ? 'Updating…' : ''}</p>}
      <div className="hp-out-body">{children}</div>
    </div>
  )
}

/** One titled block of results (a table or a plot), with an optional ƒ button at the right of its title. */
export function Block({ title, fx, children }: { title: string; fx?: ReactNode; children: ReactNode }) {
  return (
    <section className="hp-section">
      <div className="hp-section-head"><h3>{title}</h3>{fx}</div>
      {children}
    </section>
  )
}

export interface TableColumn { key: string; label: ReactNode; num?: boolean; mono?: boolean }
export interface TableRow { cells: Record<string, ReactNode>; fx?: ReactNode }

/** The results table: three rules, numbers right-aligned. A `fx` on a row adds the Formula column. */
export function DataTable({ caption, columns, rows, visibleCaption = false }: {
  caption: string; columns: readonly TableColumn[]; rows: readonly TableRow[]; visibleCaption?: boolean
}) {
  const hasFx = rows.some((row) => row.fx != null)
  return (
    <div className="hp-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="hp-table">
        <caption className={visibleCaption ? undefined : 'sr-only'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={column.num ? 'num' : undefined}>{column.label}</th>)}
            {hasFx && <th scope="col" className="hp-cell-fx"><span className="sr-only">Formula</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key} className={[column.num ? 'num' : '', column.mono ? 'mono' : ''].filter(Boolean).join(' ') || undefined}>
                  {row.cells[column.key]}
                </td>
              ))}
              {hasFx && <td className="hp-cell-fx">{row.fx}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A plot legend: a swatch drawn the way the plot draws the thing, then its name. Never colour alone. */
export function Legend({ items }: { items: readonly { label: string; swatch: CSSProperties }[] }) {
  return (
    <ul aria-label="Plot legend" className="hp-legend">
      {items.map((item) => (
        <li key={item.label}><span aria-hidden="true" style={{ display: 'inline-block', flex: 'none', ...item.swatch }} />{item.label}</li>
      ))}
    </ul>
  )
}

/** The frame of a plot: its height follows its width (usePlotHeight), so the drawing is never stretched. */
export function PlotFrame({ label, children }: { label: string; children: (height: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = usePlotHeight(ref)
  return (
    <div ref={ref} className="hp-plot" style={{ height }} role="img" aria-label={label}>
      {children(height)}
    </div>
  )
}

/** ƒ at the right of the label row above a select: the control keeps its full width. */
export function FxTop({ fx, children }: { fx: ReactNode; children: ReactNode }) {
  return <div className="hp-fxtop">{children}{fx}</div>
}

/** ƒ beside a control that carries its own label row, such as a slider with its value. */
export function FxBeside({ fx, children }: { fx: ReactNode; children: ReactNode }) {
  return <div className="hp-fxbeside">{children}{fx}</div>
}

/**
 * True for a moment after `open` turns from false to true while mounted: the step that just unlocked animates
 * and is announced, and a step that was open when the page (or the controls, after the Data drawer closed)
 * mounted is not. Kept here, not in the page state, so a remount never replays it.
 */
export function useJustOpened(open: boolean, ms = 400): boolean {
  const before = useRef(open)
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const opened = open && !before.current
    before.current = open
    if (!opened) return
    setFresh(true)
    const timer = window.setTimeout(() => setFresh(false), ms)
    return () => window.clearTimeout(timer)
  }, [open, ms])
  return fresh
}

export default Block
