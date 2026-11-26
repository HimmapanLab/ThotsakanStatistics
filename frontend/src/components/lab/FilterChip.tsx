import { useData } from '../../context/DataContext'

/** "Filtered n of N": shown on every topic page while a filter is on, and nothing when none is. */
export function FilterChip() {
  const { state, filteredRows } = useData()
  const total = state.dataset?.rows.length ?? 0
  const filtered = Object.values(state.filters).some((values) => values.length > 0)
  if (!state.dataset || !filtered) return null
  return (
    <span className="lab-chip lab-chip-filter">
      Filtered {filteredRows.length.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
    </span>
  )
}

export default FilterChip
