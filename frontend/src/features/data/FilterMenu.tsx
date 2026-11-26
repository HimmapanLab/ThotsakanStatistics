// features/data/FilterMenu.tsx
// Keep only the rows where one category column has one level. A column of type Nominal or Ordinal with at most 20
// levels can be filtered by; applying replaces any filter that was on.
import { useId, useMemo, useState, type RefObject } from 'react'
import { useData } from '../../context/DataContext'
import { haptic } from '../../lib/haptics'
import { MAX_LEVELS } from '../../utils/columnTypes'
import { Popover } from './Popover'

export function useFilterColumns(): string[] {
  const { state } = useData()
  return useMemo(
    () => state.categoricalCols.filter((col) => {
      const unique = state.profiles[col]?.nUnique ?? 0
      return unique >= 2 && unique <= MAX_LEVELS
    }),
    [state.categoricalCols, state.profiles],
  )
}

export function FilterMenu({ anchorRef, onClose }: {
  anchorRef: RefObject<HTMLElement | null>
  onClose: (returnFocus: boolean) => void
}) {
  const { state, getUniqueValues, setFilter, clearFilters } = useData()
  const columns = useFilterColumns()
  const id = useId()
  const active = Object.entries(state.filters).find(([col, values]) => values.length > 0 && columns.includes(col))
  const [col, setCol] = useState(active?.[0] ?? columns[0] ?? '')
  const levels = col ? getUniqueValues(col) : []
  const [level, setLevel] = useState(active && active[0] === col ? active[1][0] : levels[0] ?? '')

  function apply() {
    if (!col || !level) return
    clearFilters()
    setFilter(col, [level])
    haptic('confirm')
    onClose(true)
  }

  return (
    <Popover anchorRef={anchorRef} title="Filter rows" onClose={onClose}>
      {columns.length === 0 ? (
        <p className="lab-popover-body">No Nominal or Ordinal column with a few levels to filter by.</p>
      ) : (
        <div className="data-filter">
          <p className="lab-popover-body">Keep only the rows where a column has one level.</p>
          <label className="data-label" htmlFor={`${id}-col`}>Column</label>
          <select id={`${id}-col`} className="data-select" value={col}
            onChange={(event) => { setCol(event.target.value); setLevel(getUniqueValues(event.target.value)[0] ?? '') }}>
            {columns.map((name) => <option key={name}>{name}</option>)}
          </select>
          <label className="data-label" htmlFor={`${id}-level`}>Level</label>
          <select id={`${id}-level`} className="data-select" value={level} onChange={(event) => setLevel(event.target.value)}>
            {levels.map((name) => <option key={name}>{name}</option>)}
          </select>
          <div className="data-filter-actions">
            <button type="button" className="lab-btn data-btn-primary" onClick={apply}>Apply</button>
            <button type="button" className="lab-btn" onClick={() => onClose(true)}>Cancel</button>
          </div>
        </div>
      )}
    </Popover>
  )
}
