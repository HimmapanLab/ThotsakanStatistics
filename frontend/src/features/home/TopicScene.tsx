// features/home/TopicScene.tsx
// The flat illustration on each carousel slide: a pale organic blob, a rounded floor and rounded shapes, in the four
// illustration colours (ILLUSTRATION-STYLE.md). It is decoration, so it is hidden from screen readers. Three layers
// (far, mid, near) shift as the slide changes and lean toward a mouse or pen on the current slide (sceneHover.ts).
// Statistics draws the loaded dataset's own histogram.
import { useEffect, useMemo, useRef } from 'react'
import { attachSceneHover } from './sceneHover'
import {
  BELL, MARKER_TOP, REG_BLOB, REG_DASHES, REG_DOTS, REG_PLACE, REJECT_Z, REST_Z, SC, SC_BLOB, f1, scBar, sceneHist, type SceneKind,
} from './sceneGeometry'
import './scene.css'

export interface TopicSceneProps {
  kind: SceneKind
  /** The scene of the current slide reacts to the pointer; the others stand still. */
  active: boolean
  /** The densities of the loaded dataset's histogram, from the backend. Missing: a sample shape is drawn. */
  histogram?: readonly number[] | null
}

function Floor() {
  return <rect className="sc-floor" x="6" y={SC.base} width="328" height="10" rx="5" />
}

function Marker({ x }: { x: number }) {
  return (
    <g className="sc-mark" transform={`translate(${f1(x)},0)`}>
      <rect className="sc-ink" x="-3" y={MARKER_TOP} width="6" height={SC.base - MARKER_TOP} rx="3" />
      <circle className="sc-ink" cx="0" cy={MARKER_TOP} r="10" />
      <circle className="sc-paper" cx="0" cy={MARKER_TOP} r="4" />
    </g>
  )
}

function BellScene({ kind }: { kind: 'prob' | 'hyp' }) {
  const body = useMemo(() => BELL.area(-3.2, 3.2), [])
  const rest = REST_Z[kind]
  return (
    <>
      <g className="pl-far"><path className="sc-blob" d={SC_BLOB[kind]} /></g>
      <g className="pl-mid">
        <Floor />
        <path className="sc-side" transform="translate(7,0)" d={body} />
        <path className="sc-body" d={body} />
        {kind === 'prob' ? (
          <path className="sc-shade" d={BELL.area(-3.2, rest)} />
        ) : (
          <>
            <path className="sc-tail lo" d={BELL.area(-3.2, -REJECT_Z)} />
            <path className="sc-tail hi is-hit" d={BELL.area(REJECT_Z, 3.2)} />
          </>
        )}
      </g>
      <g className="pl-near"><Marker x={BELL.xOf(rest)} /></g>
    </>
  )
}

function StatsScene({ histogram }: { histogram?: readonly number[] | null }) {
  const h = useMemo(() => sceneHist(histogram), [histogram])
  const n = h.bars.length
  const bw = h.w / n
  const mx = Math.max(...h.bars) || 1
  return (
    <>
      <g className="pl-far"><path className="sc-blob" d={SC_BLOB.stats} /></g>
      <g className="pl-mid">
        <Floor />
        {h.bars.map((v, j) => (
          <path
            key={j}
            className={`sc-bar${Math.abs(j + 0.5 - h.mean) <= h.sd ? ' band' : ''}`}
            data-b={j}
            d={scBar(h.x0 + j * bw + 1.5, Math.max(2, bw - 3), Math.max(3, (v / mx) * 196), 4)}
          />
        ))}
      </g>
      <g className="pl-near">
        <rect className="sc-paper" x={f1(h.x0 + h.mean * bw - 8)} y={SC.base + 3} width="16" height="4" rx="2" />
      </g>
    </>
  )
}

const REG_T = `translate(${REG_PLACE.x},${REG_PLACE.y}) scale(${REG_PLACE.k})`

function RegScene() {
  return (
    <>
      <g className="pl-far"><g transform={REG_T}><path className="sc-blob" d={REG_BLOB} /></g></g>
      <g className="pl-mid">
        <g transform={REG_T}>
          <rect className="sc-side" x="51" y="39" width="186" height="135" rx="15" />
          <rect className="sc-body" x="42" y="39" width="186" height="135" rx="15" />
          <rect className="sc-side" x="63" y="57" width="4.5" height="96" rx="2.25" />
          <rect className="sc-side" x="63" y="148.5" width="147" height="4.5" rx="2.25" />
          {REG_DASHES.map((d, i) => (
            <rect key={i} className="sc-blob" x={d[0]} y={d[1]} width="15" height="5.25" rx="2.625" transform={`rotate(-28.81 ${d[0]} ${d[1]})`} />
          ))}
          {REG_DOTS.map((d, i) => (
            <circle key={i} className="sc-dot" data-p={i} cx={d[0]} cy={d[1]} r="5.25" />
          ))}
        </g>
      </g>
      <g className="pl-near">
        <g transform={REG_T}>
          <circle className="sc-ink" cx="52.5" cy="43.5" r="28.5" />
          <rect className="sc-paper" x="51.75" y="27" width="4.5" height="18" rx="2.25" />
          <rect className="sc-paper" x="51.75" y="41.25" width="15" height="4.5" rx="2.25" />
        </g>
      </g>
    </>
  )
}

export default function TopicScene({ kind, active, histogram }: TopicSceneProps) {
  const ref = useRef<SVGSVGElement>(null)

  // The hover is attached to the current slide only, and put away again when it stops being current or is redrawn.
  useEffect(() => {
    if (!active || !ref.current) return
    return attachSceneHover(ref.current, kind)
  }, [active, kind, histogram])

  return (
    <svg ref={ref} className="ct-scene" data-kind={kind} viewBox={`0 0 ${SC.W} ${SC.H}`} aria-hidden="true" focusable="false">
      {kind === 'stats' ? <StatsScene histogram={histogram} /> : kind === 'reg' ? <RegScene /> : <BellScene kind={kind} />}
    </svg>
  )
}
