// features/data/DataRail.tsx
// The left rail. The whole strip is one tab named Data: a click anywhere on it opens or closes the drawer, it turns
// solid blue while the drawer is open, and the dataset and its size run down it. The button inside is the keyboard
// stop. Also the home of the "data loaded" live region, because the rail is on every topic page.
import { useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useDrawer } from '../../context/DrawerContext'
import { datasetTitle } from './ExampleDatasets'
import { TableIcon } from './icons'
import './data.css'

export function railLabel(filename: string | null, rows: number | null): string {
  return filename && rows !== null ? `${datasetTitle(filename)} · ${rows.toLocaleString('en-US')} rows` : 'No data'
}

/** `disabled`: the page needs no data (Probability). The tab is greyed out; the dataset line stays as it is. */
export default function DataRail({ disabled = false }: { disabled?: boolean } = {}) {
  const { open, toggle } = useDrawer()
  const { state } = useData()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const label = railLabel(state.dataset ? state.filename : null, state.dataset?.rows.length ?? null)

  // When the drawer closes the focus goes back to the rail, however it was closed. The drawer takes its focused
  // control with it, so the focus is lost (on the page body) at that moment.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement
      if (!active || active === document.body) buttonRef.current?.focus({ preventScroll: true })
    }
    wasOpen.current = open
  }, [open])

  // "Data loaded", said once for a load that was asked for. A refresh that brings the data back says nothing,
  // because the reader did not do anything.
  const [announcement, setAnnouncement] = useState('')
  const previousStatus = useRef(state.status)
  const latestLabel = useRef(label)
  latestLabel.current = label
  useEffect(() => {
    if (previousStatus.current === 'loading' && state.status === 'ready' && state.dataset) {
      setAnnouncement(`Data loaded: ${latestLabel.current}.`)
    } else if (state.status === 'error') {
      setAnnouncement('')
    }
    previousStatus.current = state.status
  }, [state.status, state.dataset])

  return (
    <aside className={`data-rail${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} aria-label="Data"
      onClick={disabled ? undefined : toggle}>
      <button
        ref={buttonRef}
        type="button"
        className="data-rail-btn"
        aria-expanded={disabled ? undefined : open}
        aria-controls={disabled ? undefined : 'data-panel'}
        aria-disabled={disabled || undefined}
        aria-label={disabled ? 'Data (Probability needs no data)' : 'Data'}
        title={disabled ? 'Probability needs no data' : undefined}
      >
        <TableIcon />
        <span>Data</span>
      </button>
      <span className="data-rail-vert" title={label}>{label}</span>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </aside>
  )
}
