// The bench of every topic page: the page head, then the Data rail, the inputs (or the Data drawer, which takes
// their place while it is open) and the results. Prototype: benchWrap, plan() and the stacking at 760 px.
import { type ReactNode, useEffect, useRef } from 'react'
import type { Route } from '../app/routes'
import { useDrawer } from '../context/DrawerContext'
import DataDrawer from '../features/data/DataDrawer'
import DataRail from '../features/data/DataRail'
import PageHead from './PageHead'

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
      <div className={`bench${open ? ' is-drawer' : ''}`} data-route={route}>
        <div className="bench-rail" ref={railRef} data-tour="data">
          <DataRail />
        </div>
        {open && (
          <div className="bench-drawer slide-in">
            <DataDrawer />
          </div>
        )}
        <section id="inputs-panel" className="bench-inputs" aria-label="Inputs" data-tour="inputs" hidden={open}>
          {controls}
        </section>
        <main id="main" className="bench-output" aria-label="Results" ref={outputRef}>
          {observation}
        </main>
      </div>
    </div>
  )
}
