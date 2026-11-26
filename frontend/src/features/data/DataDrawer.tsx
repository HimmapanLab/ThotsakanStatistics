// STUB created by the Foundation stage so every branch compiles on its own. Owner: the Data builder, who replaces
// this file. The contract is the default export `DataDrawer()`: the drawer content that takes the place of the
// inputs panel while the drawer is open.
import { useDrawer } from '../../context/DrawerContext'

export default function DataDrawer() {
  const { setOpen } = useDrawer()
  return (
    <section id="data-panel" className="lab-stub-panel" aria-label="Data">
      <h2 className="text-base font-semibold">Data</h2>
      <p className="text-sm text-[var(--ink-muted)]">The Data drawer is being rebuilt.</p>
      <button type="button" className="lab-btn mt-3" onClick={() => setOpen(false)}>Close</button>
    </section>
  )
}
