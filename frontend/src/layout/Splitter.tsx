// layout/Splitter.tsx
// The handle on the right edge of the open panel (inputs or Data). Drag it, or focus it and use the arrow keys
// (Shift for bigger steps), Home and End; a double-click goes back to the default width. Prototype: splitHtml and
// the DRAG block in app.js, .split in kit.css.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface SplitterProps {
  /** "Inputs" or "Data": the panel it resizes, for its name and aria-controls. */
  name: string
  controls: string
  width: number
  min: number
  max: number
  /** Called while dragging (every frame) and on each key press. */
  onResize: (width: number) => void
  /** Called once when a drag or a key press is finished, to save the width. */
  onCommit: (width: number) => void
  onReset: () => void
}

const STEP = 16
const BIG_STEP = 64

export default function Splitter({ name, controls, width, min, max, onResize, onCommit, onReset }: SplitterProps) {
  const drag = useRef<{ x: number; width: number; last: number; frame: number } | null>(null)
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)))

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, width, last: width, frame: 0 }
    document.body.classList.add('is-resizing')
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.last = clamp(d.width + event.clientX - d.x)
    if (d.frame) return
    d.frame = requestAnimationFrame(() => {
      d.frame = 0
      onResize(d.last)
    })
  }
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (d.frame) cancelAnimationFrame(d.frame)
    drag.current = null
    document.body.classList.remove('is-resizing')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onResize(d.last)
    onCommit(d.last)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = width - step
    else if (event.key === 'ArrowRight') next = width + step
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    const value = clamp(next)
    onResize(value)
    onCommit(value)
  }

  return (
    <div
      className="bench-split"
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${name} panel`}
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="Drag to resize. Arrow keys move it; double-click resets."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    />
  )
}
