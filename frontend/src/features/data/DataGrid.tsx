// features/data/DataGrid.tsx
// The first rows of the data, with the column name (click to sort) and the column type (click to change) in each
// header. The type shows as a shape and a word, never colour alone.
import { useMemo, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { isNumericType } from '../../utils/columnTypes'
import { SortDownIcon, SortUpIcon, TypeIcon } from './icons'
import { TypeMenu } from './TypeMenu'
import { nextSort, sortRows, type SortState } from './gridSort'

export const PREVIEW_ROWS = 12

export function DataGrid({ label }: { label: string }) {
  const { state, filteredRows } = useData()
  const [sort, setSort] = useState<SortState | null>(null)
  const [typeCol, setTypeCol] = useState<string | null>(null)
  const typeAnchor = useRef<HTMLElement | null>(null)

  const dataset = state.dataset
  // A sort that names a column the dataset no longer has is ignored.
  const activeSort = sort && dataset?.headers.includes(sort.col) ? sort : null
  const sorted = useMemo(
    () => sortRows(filteredRows, activeSort, activeSort ? isNumericType(state.columnTypes[activeSort.col]) : false),
    [filteredRows, activeSort, state.columnTypes],
  )
  if (!dataset) return null

  const shown = sorted.slice(0, PREVIEW_ROWS)
  const rowNumber = (row: Record<string, string>) => dataset.rows.indexOf(row) + 1

  return (
    <>
      <div className="data-body" tabIndex={0} role="region" aria-label={`Rows of ${label}`}>
        <table className="data-grid">
          <caption className="sr-only">First {PREVIEW_ROWS} rows of {label}</caption>
          <thead>
            <tr>
              <th className="data-rownum" scope="col"><span className="sr-only">Row</span></th>
              {dataset.headers.map((col) => {
                const type = state.columnTypes[col]
                const dir = activeSort?.col === col ? activeSort.dir : 0
                return (
                  <th key={col} scope="col" aria-sort={dir === 1 ? 'ascending' : dir === -1 ? 'descending' : 'none'}>
                    <button type="button" className="data-th-name" onClick={() => setSort(nextSort(activeSort, col))}>
                      <span className="data-ellipsis" title={col}>{col}</span>
                      {dir === 1 && <SortUpIcon />}
                      {dir === -1 && <SortDownIcon />}
                    </button>
                    <button
                      type="button"
                      className="data-type-tag"
                      title={`Column type: ${type}. Change`}
                      aria-haspopup="dialog"
                      aria-expanded={typeCol === col}
                      aria-label={`Column type of ${col}: ${type}. Change`}
                      onClick={(event) => {
                        typeAnchor.current = event.currentTarget
                        setTypeCol(typeCol === col ? null : col)
                      }}
                    >
                      <TypeIcon type={type} />
                      <span className="data-ellipsis">{type}</span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowNumber(row)}>
                <td className="data-rownum">{rowNumber(row)}</td>
                {dataset.headers.map((col) => (
                  <td key={col} className={isNumericType(state.columnTypes[col]) ? 'is-num' : undefined} title={row[col] ?? ''}>{row[col] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="data-foot">
        Showing the first {Math.min(PREVIEW_ROWS, sorted.length).toLocaleString('en-US')} of{' '}
        {sorted.length < dataset.rows.length
          ? `${sorted.length.toLocaleString('en-US')} filtered rows (${dataset.rows.length.toLocaleString('en-US')} in all)`
          : `${dataset.rows.length.toLocaleString('en-US')} rows`}.
        {' '}Column types are guesses; click a type to change it.
      </p>
      {typeCol && (
        <TypeMenu
          col={typeCol}
          anchorRef={typeAnchor}
          onClose={(returnFocus) => {
            setTypeCol(null)
            if (returnFocus) typeAnchor.current?.focus({ preventScroll: true })
          }}
        />
      )}
    </>
  )
}
