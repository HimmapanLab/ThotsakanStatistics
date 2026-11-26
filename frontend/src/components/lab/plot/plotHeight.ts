import { useLayoutEffect, useState, type RefObject } from 'react'

/** A plot is never wider than the results cap (--results-max, 960 px) and never narrower than 300 px. */
export const PLOT_MAX_WIDTH = 960
export const PLOT_MIN_WIDTH = 300

/** A plot keeps a 2:1 shape, between 200 and 480 px tall (prototype plotH). */
export function plotHeight(width: number): number {
  return Math.min(480, Math.max(200, Math.round(width / 2)))
}

/**
 * The height for the plot inside `ref`, following the element's width as it changes (a resized window, the
 * Data drawer opening). The plot is laid out for that size, never stretched by CSS.
 */
export function usePlotHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(() => plotHeight(640))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const width = Math.min(PLOT_MAX_WIDTH, Math.max(PLOT_MIN_WIDTH, Math.floor(el.clientWidth || 640)))
      setHeight(plotHeight(width))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}
