// The first-visit tour: three steps, a spotlight on the part and a card beside it.
// Prototype: TOUR, tourUpdate, startTour, endTour.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const TOUR_KEY = 'tsl.tour'

export interface TourStep {
  /** CSS selector of the part to light up. */
  sel: string
  title: string
  text: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  { sel: '[data-tour="data"]', title: 'Data', text: 'Your data lives here. Click Data to open it in place of your inputs, then pick an example, upload a CSV or change a column’s type.' },
  { sel: '[data-tour="inputs"]', title: 'Inputs', text: 'Change these. Inputs are boxed and live on this grey panel; results update as you go.' },
  { sel: '.lab-fx', title: 'Formulas', text: 'Every number has its formula one click away.' },
]

// ── Whether the tour has been seen ───────────────────────────────────────────

let seenInMemory = false

export function tourSeen(): boolean {
  if (seenInMemory) return true
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  seenInMemory = true
  try { localStorage.setItem(TOUR_KEY, '1') } catch { /* seen for this visit only */ }
}

export function forgetTourSeen(): void {
  seenInMemory = false
  try { localStorage.removeItem(TOUR_KEY) } catch { /* nothing stored */ }
}

// ── The tour ─────────────────────────────────────────────────────────────────

/** Whether an element is on screen: rendered (not display: none, nor inside something that is) and not hidden. */
function isShown(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/** The first match that is on screen. A hidden match is never returned: its box is at 0, 0 and would pull the spotlight there. */
export function firstVisible(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(isShown) ?? null
}

interface TourProps {
  open: boolean
  /** Called when the tour ends: `finished` is true for Done and Skip, so the tour is not offered again. */
  onClose: (finished: boolean) => void
}

export default function Tour({ open, onClose }: TourProps) {
  const [index, setIndex] = useState(0)
  const spotRef = useRef<HTMLDivElement>(null)
  const coachRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const last = TOUR_STEPS.length - 1
  const step = TOUR_STEPS[Math.min(index, last)]

  // Each time the tour opens it starts at step 1. The reset happens when it closes: doing it on opening would
  // run after (and undo) the skip of a first step whose part is not on screen.
  useEffect(() => {
    if (!open) setIndex(0)
  }, [open])

  const place = useCallback(() => {
    const spot = spotRef.current
    const coach = coachRef.current
    if (!spot || !coach) return
    const target = firstVisible(step.sel) ?? firstVisible('.bench-output') ?? document.body
    const r = target.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const top = Math.max(r.top, 4)
    const bottom = Math.min(r.bottom, vh - 4)
    spot.style.left = `${Math.max(2, r.left - 5)}px`
    spot.style.top = `${top - 5}px`
    spot.style.width = `${Math.min(vw - 4, r.width + 10)}px`
    spot.style.height = `${Math.max(20, bottom - top + 10)}px`
    // The card goes to the right of the part when there is room, else under it; always inside the window.
    const w = coach.offsetWidth
    const h = coach.offsetHeight
    let left = r.left
    let cardTop = bottom + 8
    if (r.right + 12 + w <= vw - 8) { left = r.right + 12; cardTop = top - 8 }
    left = Math.min(Math.max(8, left), Math.max(8, vw - w - 8))
    if (cardTop + h > vh - 8) {
      const above = top - h - 8
      cardTop = above >= 8 ? above : Math.max(8, vh - h - 8)
    }
    cardTop = Math.min(Math.max(8, cardTop), Math.max(8, vh - h - 8))
    coach.style.left = `${Math.round(left)}px`
    coach.style.top = `${Math.round(cardTop)}px`
  }, [step])

  // A step whose part is not on the page yet (no formula before results) waits behind the last one.
  useLayoutEffect(() => {
    if (!open) return
    if (index < last && !firstVisible(step.sel)) { setIndex(index + 1); return }
    const target = firstVisible(step.sel)
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    place()
  }, [open, index, last, step, place])

  // Keep the spotlight on its part through resizes and scrolls.
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const target = firstVisible(step.sel)
    const observer = typeof ResizeObserver === 'undefined' || !target ? null : new ResizeObserver(place)
    if (target) observer?.observe(target)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      observer?.disconnect()
    }
  }, [open, step, place])

  // Focus goes to Next on each step, and back to the opener when the tour ends.
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    return () => {
      const back = opener.current
      opener.current = null
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    nextRef.current?.focus({ preventScroll: true })
  }, [open, index])

  const end = useCallback(() => onClose(true), [onClose])

  // Esc ends the tour; Tab stays on the card.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        end()
        return
      }
      if (event.key !== 'Tab') return
      const coach = coachRef.current
      const buttons = [...(coach?.querySelectorAll<HTMLElement>('button') ?? [])]
      if (!buttons.length) return
      const first = buttons[0]
      const lastButton = buttons[buttons.length - 1]
      const active = document.activeElement
      if (!coach?.contains(active)) { first.focus(); event.preventDefault() }
      else if (event.shiftKey && active === first) { lastButton.focus(); event.preventDefault() }
      else if (!event.shiftKey && active === lastButton) { first.focus(); event.preventDefault() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, end])

  if (!open) return null

  return createPortal(
    <>
      <div ref={spotRef} className="tour-spot" aria-hidden="true" />
      <div ref={coachRef} className="tour-coach" role="dialog" aria-label={`Tour, step ${index + 1} of ${TOUR_STEPS.length}`}>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-foot">
          <span className="tour-count">{index + 1} of {TOUR_STEPS.length}</span>
          <button type="button" className="sh-btn sh-btn-quiet" onClick={end}>Skip</button>
          {index > 0 && <button type="button" className="sh-btn" onClick={() => setIndex(index - 1)}>Back</button>}
          <button ref={nextRef} type="button" className="sh-btn sh-btn-primary"
            onClick={() => (index >= last ? end() : setIndex(index + 1))}>
            {index >= last ? 'Done' : 'Next'}
          </button>
        </div>
        <span className="sr-only" role="status" aria-live="polite">Tour, step {index + 1} of {TOUR_STEPS.length}: {step.title}</span>
      </div>
    </>,
    document.body,
  )
}
