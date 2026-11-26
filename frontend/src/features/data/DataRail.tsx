// STUB created by the Foundation stage so every branch compiles on its own. Owner: the Data builder, who replaces
// this file. The contract is the default export `DataRail()`: the left rail, one tab labelled Data, solid blue
// while the drawer is open.
import { useDrawer } from '../../context/DrawerContext'

export default function DataRail() {
  const { open, toggle } = useDrawer()
  return (
    <aside className="lab-stub-rail" aria-label="Data">
      <button type="button" aria-expanded={open} aria-controls="data-panel" aria-label="Data" onClick={toggle}>
        <svg className="lab-icon" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="4" width="14" height="12" rx="1.5" />
          <path d="M3 8.5h14M3 12.5h14M8 4v12" />
        </svg>
        <span>Data</span>
      </button>
    </aside>
  )
}
