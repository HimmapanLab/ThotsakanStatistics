import { useRef, type ReactNode } from 'react'
import { usePlotHeight } from '../../../components/lab/plot/plotHeight'
import './estimation.css'

/** The box a plot is drawn in: at most 960 px wide, 2:1 and between 200 and 480 px tall (plotHeight). */
export default function PlotBox({ children, label }: { children: (height: number) => ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = usePlotHeight(ref)
  return <div ref={ref} className="est-plot" role={label ? 'group' : undefined} aria-label={label}>{children(height)}</div>
}
