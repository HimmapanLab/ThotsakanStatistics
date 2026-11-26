import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type ExportFormat = 'png' | 'csv' | 'pdf'
export type ExportHandlers = Record<ExportFormat, () => void | Promise<void>>

interface ExportMenuProps {
  handlers?: ExportHandlers
  ready?: boolean
  disabledReason?: string
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg className="lab-icon" viewBox="0 0 20 20" aria-hidden="true">{children}</svg>
)
const DownloadIcon = () => <Svg><path d="M10 3.5v9M6.5 9L10 12.5 13.5 9M4 14.5v2h12v-2" /></Svg>
const ChevronIcon = () => <Svg><path d="M5.5 8l4.5 4.5L14.5 8" /></Svg>
const DoneIcon = () => <Svg><path d="M4.5 10.5l3.5 3.5 7.5-8" /></Svg>
const ImageIcon = () => <Svg><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M3.5 14l4-4 3 3 2-2 4 4" /><circle cx="13" cy="7.5" r="1.25" /></Svg>
const TableIcon = () => <Svg><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M3 8.5h14M3 12.5h14M8 4v12" /></Svg>
const ReportIcon = () => <Svg><path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5z" /><path d="M11.5 2.5V6H15M8 10h5M8 13h5" /></Svg>

/** What each format holds. CSV keeps every value in full; the PDF rounds as the screen does (decisions.md, Display precision). */
const ITEMS: { key: ExportFormat; name: string; hint: string; icon: () => ReactNode }[] = [
  { key: 'png', name: 'Chart image', hint: 'PNG · the plots as shown', icon: ImageIcon },
  { key: 'csv', name: 'Result table', hint: 'CSV · every value in full', icon: TableIcon },
  { key: 'pdf', name: 'Report', hint: 'PDF · plots and tables, rounded', icon: ReportIcon },
]

/** How long "Exported" stays on the button after a file is saved. */
const DONE_MS = 1600

/**
 * The Export button at the right of a results heading, with its list of formats. Arrow keys, Home and End move
 * through the list; Esc, Tab or a click outside close it. While a file is made the button says so, then says
 * "Exported" for a moment; a failure shows under the button.
 */
export default function ExportMenu({ handlers, ready = true, disabledReason }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [done, setDone] = useState<ExportFormat | null>(null)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listId = useId()
  const enabled = ready && !!handlers && !busy

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const closeOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [open])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(null), DONE_MS)
    return () => window.clearTimeout(timer)
  }, [done])

  async function run(format: ExportFormat) {
    if (!enabled || !handlers || busyRef.current) return
    busyRef.current = true
    setOpen(false)
    setBusy(format)
    setDone(null)
    setError(null)
    try {
      await handlers[format]()
      setDone(format)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
      triggerRef.current?.focus()
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null)
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? (at + 1) % items.length
      : event.key === 'ArrowUp' ? (at - 1 + items.length) % items.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? items.length - 1 : null
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  const label = busy ? `Exporting ${busy.toUpperCase()}…` : done ? 'Exported' : 'Export'

  return (
    <div ref={rootRef} className="lab-export" onKeyDown={onKeyDown}
      onBlur={(event) => { if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
      <button ref={triggerRef} type="button" className="lab-btn lab-export-btn" aria-expanded={open} aria-controls={listId}
        aria-busy={!!busy || undefined} title={!enabled && !busy ? disabledReason : undefined} disabled={!enabled}
        data-done={done ? '' : undefined}
        onClick={() => { setError(null); setOpen((value) => !value) }}
        onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open && enabled) { event.preventDefault(); setOpen(true) } }}>
        {done ? <DoneIcon /> : <DownloadIcon />}
        <span>{label}</span>
        <span className="lab-export-chev"><ChevronIcon /></span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{done ? `${done.toUpperCase()} exported.` : ''}</span>

      {open && (
        <div id={listId} className="lab-export-pop" role="group" aria-label="Export formats">
          {ITEMS.map((item, index) => (
            <button key={item.key} ref={(node) => { itemRefs.current[index] = node }} type="button" className="lab-export-item"
              onClick={() => void run(item.key)}>
              <span className="lab-export-ico">{item.icon()}</span>
              <span className="lab-export-name">{item.name}</span>
              <span className="lab-export-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="lab-export-error">{error}</p>}
    </div>
  )
}
