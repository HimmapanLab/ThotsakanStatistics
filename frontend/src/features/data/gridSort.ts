// features/data/gridSort.ts
// Sorting the rows the Data grid shows. The whole set is sorted, not just the rows on screen, so "ascending" really
// shows the smallest values first. Blank cells always go last. Equal values keep their order in the file.
import { isMissingCell } from '../../utils/columnTypes'

export interface SortState { col: string; dir: 1 | -1 }

/** The next click on a column header: first ascending, then descending, on another column ascending again. */
export function nextSort(current: SortState | null, col: string): SortState {
  return current && current.col === col ? { col, dir: current.dir === 1 ? -1 : 1 } : { col, dir: 1 }
}

export function sortRows(rows: Record<string, string>[], sort: SortState | null, numeric: boolean): Record<string, string>[] {
  if (!sort) return rows
  const { col, dir } = sort
  const keyed = rows.map((row, index) => {
    const text = row[col] ?? ''
    return { row, index, text, missing: isMissingCell(text), value: numeric ? Number(text) : 0 }
  })
  keyed.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1
    if (a.missing) return a.index - b.index
    let order: number
    if (numeric && !Number.isNaN(a.value) && !Number.isNaN(b.value)) order = a.value - b.value
    else if (numeric && Number.isNaN(a.value) !== Number.isNaN(b.value)) return Number.isNaN(a.value) ? 1 : -1
    else order = a.text.localeCompare(b.text, undefined, { numeric: true })
    return order * dir || a.index - b.index
  })
  return keyed.map((item) => item.row)
}
