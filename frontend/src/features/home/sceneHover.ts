// features/home/sceneHover.ts
// The hover of one carousel scene: it leans toward the pointer and acts out its topic under it. Mouse and pen
// only (a finger keeps swiping). One requestAnimationFrame loop per scene, refs and plain variables only: nothing
// here calls React setState on pointermove. SVG attributes, classes and one CSS variable are written directly.
//
//   --lx      -1..1, where the pointer is across the slide; the CSS leans the three layers by 12, 6 and 2 px
//   prob      the shaded area and the marker follow the pointer, so you fill P(X <= x)
//   hyp       the marker follows the pointer; a rejection tail turns blue when the marker is inside it
//   stats     the bar under the pointer lifts and darkens, its neighbours light up
//   reg       the nearest dot grows
//
// Reduced motion: the highlights still change, but nothing leans and the marker does not glide.
import { BELL, REG_REACH, REG_SCENE_DOTS, REJECT_Z, REST_Z, SC, clamp, f1, type SceneKind } from './sceneGeometry'

/** The bars of the Statistics scene start here and span this much of the scene (see sceneHist). */
const BAR_X0 = 24
const BAR_SPAN = 292

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function attachSceneHover(svg: SVGSVGElement, kind: SceneKind): () => void {
  const slide = (svg.closest('.ct-slide') as HTMLElement | null) ?? svg.parentElement
  if (!slide) return () => {}

  const marker = svg.querySelector('.sc-mark')
  const shade = svg.querySelector('.sc-shade')
  const tailLo = svg.querySelector('.sc-tail.lo')
  const tailHi = svg.querySelector('.sc-tail.hi')
  const bars = Array.from(svg.querySelectorAll('.sc-bar'))
  const dots = Array.from(svg.querySelectorAll('.sc-dot'))
  const isBell = kind === 'prob' || kind === 'hyp'
  const restX = isBell ? BELL.xOf(REST_Z[kind as 'prob' | 'hyp']) : 0

  let x: number | null = null // the marker, in scene units
  let tx = restX // where it is going
  let raf = 0
  let hot = -1

  /** Write the bell scenes' marker, shade and tails for the marker at scene x. */
  function apply() {
    if (!isBell || x === null) return
    const z = clamp(BELL.zOf(x), -3.05, 3.05)
    marker?.setAttribute('transform', `translate(${f1(BELL.xOf(z))},0)`)
    if (kind === 'prob') shade?.setAttribute('d', BELL.area(-3.2, z))
    else {
      tailLo?.classList.toggle('is-hit', z <= -REJECT_Z)
      tailHi?.classList.toggle('is-hit', z >= REJECT_Z)
    }
  }

  function setHot(j: number) {
    if (j === hot) return
    hot = j
    svg.classList.toggle('is-probing', j >= 0)
    if (kind === 'stats') {
      bars.forEach((b, k) => {
        b.classList.toggle('is-hot', k === j)
        b.classList.toggle('is-warm', j >= 0 && Math.abs(k - j) === 1)
      })
    } else if (kind === 'reg') {
      dots.forEach((d, k) => d.classList.toggle('is-hot', k === j))
    }
  }

  function tick() {
    raf = 0
    if (x === null) return
    const d = tx - x
    x = Math.abs(d) < 0.4 || prefersReducedMotion() ? tx : x + d * 0.2
    apply()
    if (x !== tx) raf = requestAnimationFrame(tick)
  }

  /** Point the scene at scene x, or back to rest when null. */
  function target(at: number | null) {
    if (isBell) {
      tx = at === null ? restX : at
      if (x === null) x = restX
      if (!raf) raf = requestAnimationFrame(tick)
    } else if (kind === 'stats') {
      const j = at === null ? -1 : Math.floor((at - BAR_X0) / (BAR_SPAN / Math.max(1, bars.length)))
      setHot(j >= 0 && j < bars.length ? j : -1)
    } else if (kind === 'reg') {
      let best = -1
      let bd = REG_REACH
      if (at !== null) {
        REG_SCENE_DOTS.forEach((p, i) => {
          const dd = Math.abs(p[0] - at)
          if (dd < bd) { bd = dd; best = i }
        })
      }
      setHot(best)
    }
  }

  function onMove(event: Event) {
    const e = event as PointerEvent
    if (e.pointerType === 'touch') return
    const sr = slide!.getBoundingClientRect()
    const r = svg.getBoundingClientRect()
    if (!prefersReducedMotion() && sr.width > 0) svg.style.setProperty('--lx', f1(clamp(((e.clientX - sr.left) / sr.width) * 2 - 1, -1, 1)))
    const over = r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 24 && e.clientY <= r.bottom
    target(over ? ((e.clientX - r.left) / r.width) * SC.W : null)
  }

  function onLeave(event: Event) {
    // A finger lifting is not the pointer leaving.
    if ((event as PointerEvent).pointerType === 'touch') return
    svg.style.setProperty('--lx', '0')
    target(null)
  }

  slide.addEventListener('pointermove', onMove, { passive: true })
  slide.addEventListener('pointerleave', onLeave)

  return () => {
    slide.removeEventListener('pointermove', onMove)
    slide.removeEventListener('pointerleave', onLeave)
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    // Back to rest at once: the slide stopped being the current one, or the scene is being redrawn.
    svg.style.setProperty('--lx', '0')
    setHot(-1)
    if (isBell) {
      x = restX
      tx = restX
      apply()
    }
  }
}
