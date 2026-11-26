import type { CSSProperties, ReactNode } from 'react'
import './estimation.css'

export interface TableColumn { key: string; label: ReactNode; num?: boolean; className?: string }
export interface TableRow {
  key: string
  /** Quantity class for the name colour, e.g. q-mean (the same colour as that quantity in the plots). */
  q?: string
  /** A heading row is shown above this one when its group differs from the row before. */
  group?: string
  cells: Record<string, ReactNode>
  /** The ƒ button of this row. */
  fx?: ReactNode
}

/**
 * The one table look of the Statistics pages: rules above and below, numbers right-aligned, the first column
 * and the ƒ column fixed when the table scrolls sideways. The first column is the row's name.
 */
export default function ResultsTable({ caption, columns, rows }: {
  caption: ReactNode
  columns: readonly TableColumn[]
  rows: readonly TableRow[]
}) {
  const span = columns.length + 1
  return (
    <div className="est-table-wrap" role="region" aria-label={typeof caption === 'string' ? caption : undefined} tabIndex={0}>
      <table className="est-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={[column.num ? 'num' : '', column.className ?? ''].join(' ').trim() || undefined}>{column.label}</th>
            ))}
            <th scope="col" className="cell-fx"><span className="sr-only">Formula</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const heading = row.group !== undefined && row.group !== rows[index - 1]?.group
            return [
              heading && <tr key={`g-${row.key}`} className="grp"><td colSpan={span}>{row.group}</td></tr>,
              <tr key={row.key} className={`q ${row.q ?? ''}`.trim()}>
                {columns.map((column, at) => (
                  <td key={column.key} className={[column.num ? 'num' : '', column.className ?? ''].join(' ').trim() || undefined}>
                    {at === 0 ? <span className="qname">{row.cells[column.key]}</span> : row.cells[column.key]}
                  </td>
                ))}
                <td className="cell-fx">{row.fx}</td>
              </tr>,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

export interface LegendItem {
  label: ReactNode
  kind: 'solid' | 'dashed' | 'dotted' | 'area' | 'dot'
  color: string
  /** A value shown after the label, in display precision. */
  value?: string
}

/** The key under a plot. Colours are plot/theme.ts or token values, never new ones. */
export function Legend({ items, label = 'Plot legend' }: { items: readonly LegendItem[]; label?: string }) {
  return (
    <ul className="est-legend" aria-label={label}>
      {items.map((item, index) => (
        <li key={index}>
          <span className={`sw ${item.kind === 'solid' ? '' : item.kind}`.trim()} style={{ '--c': item.color } as CSSProperties} aria-hidden="true" />
          <span>{item.label}{item.value != null && <> <span className="val">{item.value}</span></>}</span>
        </li>
      ))}
    </ul>
  )
}
