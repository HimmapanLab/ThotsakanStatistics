// The bench of every topic page: the page head, then the Data rail, the inputs (or the Data drawer, which takes
// their place while it is open) and the results. Prototype: benchWrap, plan() and the stacking at 760 px.
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Route } from '../app/routes'
import { useDrawer } from '../context/DrawerContext'
import DataDrawer from '../features/data/DataDrawer'
import DataRail from '../features/data/DataRail'
import PageHead from './PageHead'
import Splitter from './Splitter'
import { PANEL_LIMITS, RESULTS_MIN_REM, clampWidth, loadWidths, panelRange, saveWidths, type PanelKind, type PanelWidths } from './benchLayout'

interface LabBenchProps {
  route: Route
  /** The input steps. They stay mounted, hidden, while the Data drawer is open, so nothing typed is lost. */
  controls: ReactNode
  /** The results. */
  observation: ReactNode
}

export default function LabBench({ route, controls, observation }: LabBenchProps) {
  const { open, setOpen } = useDrawer()
  const outputRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const wasOpen = useRef(open)
  const benchRef = useRef<HTMLDivElement | null>(null)
  // Probability needs no data: its Data tab is greyed out, and Data never stays open there.
  const dataOff = route === 'probability'

  // ── Resizable panels ────────────────────────────────────────────────────
  // The reader's widths (saved), and the room the bench has now. The room is measured, so the limits follow the
  // window and the text size; stacked phones (one column) have no handle.
  const [widths, setWidths] = useState<PanelWidths>(loadWidths)
  const [room, setRoom] = useState<{ width: number; resultsMin: number; stacked: boolean }>({ width: 0, resultsMin: 420, stacked: false })
  useEffect(() => {
    const bench = benchRef.current
    if (!bench || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const rail = bench.querySelector<HTMLElement>('.bench-rail')
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14
      const stacked = window.matchMedia?.('(max-width: 760px)').matches ?? false
      setRoom({ width: bench.clientWidth - (rail?.offsetWidth ?? 48), resultsMin: Math.round(RESULTS_MIN_REM * rootPx), stacked })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bench)
    // A new text size changes the root font size (the results' least width, the rail) without resizing the bench.
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const kind: PanelKind = open ? 'drawer' : 'inputs'
  const width = room.width ? clampWidth(kind, widths[kind], room.width, room.resultsMin) : widths[kind]
  const range = room.width ? panelRange(kind, room.width, room.resultsMin) : PANEL_LIMITS[kind]
  const resize = useCallback((next: number) => setWidths((current) => ({ ...current, [kind]: next })), [kind])
  const commit = useCallback((next: number) => setWidths((current) => {
    const saved = { ...current, [kind]: next }
    saveWidths(saved)
    return saved
  }), [kind])
  const reset = useCallback(() => commit(PANEL_LIMITS[kind].def), [commit, kind])

  useEffect(() => {
    if (dataOff && open) setOpen(false)
  }, [dataOff, open, setOpen])

  // Plotly listens to the window's resize, while the results change width when Data opens. Tell it, without
  // remounting charts or their settings.
  useEffect(() => {
    const output = outputRef.current
    if (!output || typeof ResizeObserver === 'undefined') return
    let previousWidth = -1
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === previousWidth) return
      previousWidth = entry.contentRect.width
      window.dispatchEvent(new Event('resize'))
    })
    observer.observe(output)
    return () => observer.disconnect()
  }, [])

  // Closing Data puts focus back on its tab, where it was opened from.
  useEffect(() => {
    if (wasOpen.current && !open) railRef.current?.querySelector<HTMLElement>('button, [tabindex]')?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open])

  // Esc closes Data, unless something open on top of it (a menu, a popover, a sheet) already used the key.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <div className="shell-bench">
      <PageHead route={route} />
      <div className={`bench${open ? ' is-drawer' : ''}`} data-route={route} ref={benchRef}
        style={{ '--panel-w': `${width}px` } as CSSProperties}>
        <div className="bench-rail" ref={railRef} data-tour="data">
          <DataRail disabled={dataOff} />
        </div>
        {open && (
          <div className="bench-drawer slide-in">
            <DataDrawer />
          </div>
        )}
        <section id="inputs-panel" className="bench-inputs" aria-label="Inputs" data-tour="inputs" hidden={open}>
          {controls}
        </section>
        {!room.stacked && (
          <Splitter name={open ? 'Data' : 'Inputs'} controls={open ? 'data-panel' : 'inputs-panel'}
            width={width} min={range.min} max={range.max} onResize={resize} onCommit={commit} onReset={reset} />
        )}
        <main id="main" className="bench-output" aria-label="Results" ref={outputRef}>
          {observation}
        </main>
      </div>
    </div>
  )
}
