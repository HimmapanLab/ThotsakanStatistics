import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import MathFormula from '../MathFormula'

/** One popover is open at a time: opening one tells the others to close. */
const OPENED = 'lab:formula-opened'

/**
 * The ƒ button. It sits beside an option or a result row and opens that formula only, typeset with KaTeX, in a
 * small popover. Esc, the close button or a click outside closes it; Esc and the close button put focus back on
 * the ƒ button. `tex` is the formula(s) from backend/core (a string or a list, each its own block); `children`
 * is the plain-language line under the title.
 */
export function FormulaButton({ title, tex, children }: {
  title: string
  tex?: string | string[]
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const blocks = tex === undefined ? [] : Array.isArray(tex) ? tex : [tex]

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true })
  }, [])

  // Place the popover under the button, inside the viewport even when the button has scrolled out of it.
  const place = useCallback(() => {
    const pop = popRef.current
    const anchor = buttonRef.current
    if (!pop || !anchor) return
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const r = anchor.getBoundingClientRect()
    const w = pop.offsetWidth
    const h = pop.offsetHeight
    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8))
    let top = r.bottom + 8
    if (top + h > vh - 8) {
      const above = r.top - h - 8
      top = above >= 8 ? above : Math.max(8, vh - h - 8)
    }
    top = Math.min(Math.max(8, top), Math.max(8, vh - h - 8))
    pop.style.left = `${Math.round(left)}px`
    pop.style.top = `${Math.round(top)}px`
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    popRef.current?.focus({ preventScroll: true })
  }, [open, place])

  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent(OPENED, { detail: id }))
    const onOther = (event: Event) => { if ((event as CustomEvent).detail !== id) setOpen(false) }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (popRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close(false)
    }
    window.addEventListener(OPENED, onOther)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener(OPENED, onOther)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, id, close, place])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="lab-fx"
        aria-label={`Formula for ${title}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        ƒ
      </button>
      {open && createPortal(
        <div ref={popRef} id={id} className="lab-popover" role="dialog" aria-label={`Formula: ${title}`} tabIndex={-1}>
          <div className="lab-popover-head">
            <h3>{title}</h3>
            <button type="button" className="lab-btn-quiet lab-btn-icon" aria-label="Close formula" onClick={() => close(true)}>
              <svg className="lab-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>
          {children != null && <div className="lab-popover-body">{typeof children === 'string' ? <p>{children}</p> : children}</div>}
          {blocks.map((block, index) => (
            <div className="lab-tex" key={index}><MathFormula tex={block} /></div>
          ))}
          {blocks.length > 0 && <p className="lab-popover-src">Formula from backend/core.</p>}
        </div>,
        document.body,
      )}
    </>
  )
}

export default FormulaButton
