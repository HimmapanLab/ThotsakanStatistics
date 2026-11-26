// features/data/Popover.tsx
// A small dialog under its button, for the column type menu and the filter. Esc and a click outside close it; Esc
// and the close button put focus back on the button that opened it. Tab stays inside while it is open.
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

export function Popover({ anchorRef, title, onClose, children }: {
  anchorRef: RefObject<HTMLElement | null>
  title: string
  /** `returnFocus` is true when the reader closed it with the keyboard or the close button. */
  onClose: (returnFocus: boolean) => void
  children: ReactNode
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    const place = () => {
      const pop = popRef.current
      const anchor = anchorRef.current
      if (!pop || !anchor) return
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const r = anchor.getBoundingClientRect()
      const left = Math.min(Math.max(8, r.left), Math.max(8, vw - pop.offsetWidth - 8))
      let top = r.bottom + 6
      if (top + pop.offsetHeight > vh - 8) {
        const above = r.top - pop.offsetHeight - 6
        top = above >= 8 ? above : Math.max(8, vh - pop.offsetHeight - 8)
      }
      pop.style.left = `${Math.round(left)}px`
      pop.style.top = `${Math.round(top)}px`
    }
    place()
    popRef.current?.focus({ preventScroll: true })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorRef])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const pop = popRef.current
      if (!pop) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation() // the drawer behind must not close too
        onClose(true)
      } else if (event.key === 'Tab') {
        const items = Array.from(pop.querySelectorAll<HTMLElement>('button, select, input, [tabindex="0"]'))
          .filter((element) => !(element as HTMLButtonElement).disabled)
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || active === pop)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
      }
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (popRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [anchorRef, onClose])

  return createPortal(
    <div ref={popRef} className="lab-popover data-popover" role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <div className="lab-popover-head">
        <h3 id={`${id}-title`}>{title}</h3>
        <button type="button" className="lab-btn-quiet lab-btn-icon" aria-label="Close" onClick={() => onClose(true)}><CloseIcon /></button>
      </div>
      {children}
    </div>,
    document.body,
  )
}
