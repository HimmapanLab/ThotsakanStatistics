// features/home/sceneGeometry.ts
// The drawing of the carousel scenes as plain numbers and path strings, ported from the approved prototype
// (SC, SC_BLOB, SC_BELL, SC_REG, scHist). Nothing here touches the DOM. The scenes stand in a 340 x 300 box on one
// rounded floor at y 262, in front of their own pale blob (ILLUSTRATION-STYLE.md).

export const SC = { W: 340, H: 300, base: 262 } as const

export type SceneKind = 'prob' | 'stats' | 'hyp' | 'reg'

/** Round to one decimal, as a short number for a path. */
export function f1(v: number): string {
  return (Math.round(v * 10) / 10).toString()
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

type Point = readonly [number, number]

export function pathOf(points: readonly Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])},${f1(p[1])}`).join('')
}

/** Each topic has a slightly different blob. */
export const SC_BLOB: Record<'prob' | 'stats' | 'hyp', string> = {
  prob: 'M64,96C92,42 170,22 236,38C298,54 334,108 324,168C314,226 264,258 196,266C128,274 62,256 34,208C8,164 40,140 64,96Z',
  stats: 'M48,128C56,70 116,30 186,32C258,34 318,74 326,140C334,204 290,254 222,264C154,274 76,262 44,220C22,192 44,160 48,128Z',
  hyp: 'M80,74C126,30 214,26 270,62C320,94 336,158 312,208C288,256 222,272 158,266C94,260 34,236 22,182C10,128 40,112 80,74Z',
}

/** A bar with rounded top corners and a square foot, so it sits flush on the floor. */
export function scBar(x: number, w: number, h: number, r: number): string {
  const y = SC.base - h
  const rr = Math.min(r, w / 2, h)
  return `M${f1(x)},${SC.base}V${f1(y + rr)}Q${f1(x)},${f1(y)} ${f1(x + rr)},${f1(y)}H${f1(x + w - rr)}Q${f1(x + w)},${f1(y)} ${f1(x + w)},${f1(y + rr)}V${SC.base}Z`
}

// ── The bell shared by the Probability and Hypothesis scenes ──────────────────────────────────────────────────

const BELL_X0 = 20
const BELL_X1 = 320
const BELL_TOP = 78
const BELL_POINTS: [number, number, number][] = []
for (let i = 0; i <= 96; i++) {
  const z = -3.2 + i * (6.4 / 96)
  const y = Math.exp((-z * z) / 2)
  BELL_POINTS.push([BELL_X0 + ((z + 3.2) / 6.4) * (BELL_X1 - BELL_X0), SC.base - y * (SC.base - BELL_TOP), z])
}

export const BELL = {
  /** The standard-normal z at a scene x, and back. */
  zOf: (x: number) => ((x - BELL_X0) / (BELL_X1 - BELL_X0)) * 6.4 - 3.2,
  xOf: (z: number) => BELL_X0 + ((z + 3.2) / 6.4) * (BELL_X1 - BELL_X0),
  yOf: (z: number) => SC.base - Math.exp((-z * z) / 2) * (SC.base - BELL_TOP),
  /** The closed path under the curve from z = lo to z = hi, down to the floor. */
  area(lo: number, hi: number): string {
    const inside = BELL_POINTS.filter((q) => q[2] >= lo && q[2] <= hi).map((q): Point => [q[0], q[1]])
    const pts: Point[] = [[BELL.xOf(lo), SC.base], [BELL.xOf(lo), BELL.yOf(lo)], ...inside, [BELL.xOf(hi), BELL.yOf(hi)], [BELL.xOf(hi), SC.base]]
    return pathOf(pts) + 'Z'
  },
}

/** Where each bell scene rests when nothing hovers over it. */
export const REST_Z = { prob: 0.8, hyp: 2.4 } as const

/** The two-sided rejection region of the Hypothesis scene (alpha = 0.05). */
export const REJECT_Z = 1.96

/** The marker's top, where its dot sits. */
export const MARKER_TOP = 52

// ── Linear Regression: the Figma component Illustration/Coming later, placed in the scene box ──────────────────

export const REG_BLOB = 'M31.3,91.6C28.3,49.6 82.3,22.6 148.3,25.6C211.3,19.6 268.3,55.6 262.3,109.6C259.3,163.6 208.3,193.6 142.3,190.6C79.3,196.6 34.3,151.6 31.3,91.6Z'
/** Its dots and trend dashes on the 288 x 216 canvas. */
export const REG_DOTS: readonly Point[] = [[81, 126], [102, 132], [120, 108], [141, 111], [159, 90], [180, 96], [201, 72]]
export const REG_DASHES: readonly Point[] = [
  [76.1634, 139.314], [98.9633, 126.714], [121.763, 114.114], [144.563, 101.514], [167.363, 88.9143], [190.163, 76.3143],
]
/** Where the canvas sits in the scene box. */
export const REG_PLACE = { x: 12, y: 30, k: 1.1 } as const
/** The dots in scene units, for the hover. */
export const REG_SCENE_DOTS: readonly Point[] = REG_DOTS.map((d): Point => [REG_PLACE.x + d[0] * REG_PLACE.k, REG_PLACE.y + d[1] * REG_PLACE.k])
/** A dot is the nearest one only within this many scene units. */
export const REG_REACH = 22

// ── Statistics: a histogram, trimmed to its middle 98% and regrouped into about 22 bars ───────────────────────

/** A plausible histogram, drawn while no data is loaded. */
export const SAMPLE_DENSITIES = [2, 14, 22, 38, 61, 74, 90, 97, 100, 116, 110, 118, 124, 117, 111, 114, 103, 89, 87, 103, 125, 146, 157, 129, 126, 105, 90, 76, 69, 60, 48, 48, 35, 32, 27, 23, 16, 14, 11, 10, 7, 5]

export interface SceneHist {
  bars: number[]
  /** Mean and standard deviation of the bars, in bar units, for the shaded one-sd band. */
  mean: number
  sd: number
  x0: number
  w: number
}

export function sceneHist(densities?: readonly number[] | null): SceneHist {
  const d = densities && densities.length > 1 ? densities.slice() : SAMPLE_DENSITIES.slice()
  const tot = d.reduce((s, v) => s + v, 0) || 1
  let c = 0
  let lo = 0
  let hi = d.length - 1
  for (let i = 0; i < d.length; i++) {
    c += d[i]
    if (c / tot < 0.01) lo = i + 1
    if (c / tot <= 0.99) hi = i + 1
  }
  hi = Math.min(d.length - 1, Math.max(hi, lo))
  const src = d.slice(lo, hi + 1)
  const n = Math.min(22, src.length)
  const bars: number[] = []
  for (let j = 0; j < n; j++) {
    const a = Math.floor((j * src.length) / n)
    const b = Math.floor(((j + 1) * src.length) / n)
    let s = 0
    for (let k = a; k < b; k++) s += src[k]
    bars.push(s / Math.max(1, b - a))
  }
  const w = bars.reduce((s, v) => s + v, 0) || 1
  const mean = bars.reduce((s, v, j) => s + v * (j + 0.5), 0) / w
  const sd = Math.sqrt(bars.reduce((s, v, j) => s + v * Math.pow(j + 0.5 - mean, 2), 0) / w)
  return { bars, mean, sd, x0: 24, w: 292 }
}
