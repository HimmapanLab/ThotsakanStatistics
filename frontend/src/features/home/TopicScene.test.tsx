import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopicScene from './TopicScene'
import { BELL, REG_SCENE_DOTS, SC, sceneHist, type SceneKind } from './sceneGeometry'

let root: Root
let container: HTMLDivElement
let frames: FrameRequestCallback[]
let reduced = false

/** Run animation frames until the scene settles (or a safety limit is hit). */
function settle() {
  for (let i = 0; i < 200 && frames.length; i++) {
    const batch = frames.splice(0)
    act(() => batch.forEach((cb) => cb(0)))
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  frames = []
  reduced = false
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => { frames = [] })
  window.matchMedia = ((query: string) => ({ matches: reduced && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** A slide 700 px wide whose scene box starts at x 300 and is 340 px wide, so one pixel is one scene unit. */
function mount(kind: SceneKind, active = true, histogram?: number[]) {
  act(() => root.render(
    <article className="ct-slide is-current">
      <TopicScene kind={kind} active={active} histogram={histogram} />
    </article>,
  ))
  const slide = container.querySelector('.ct-slide') as HTMLElement
  const svg = container.querySelector('svg') as SVGSVGElement
  slide.getBoundingClientRect = () => ({ left: 0, right: 700, top: 0, bottom: 440, width: 700, height: 440, x: 0, y: 0, toJSON() {} })
  svg.getBoundingClientRect = () => ({ left: 300, right: 640, top: 70, bottom: 370, width: 340, height: 300, x: 300, y: 70, toJSON() {} })
  return { slide, svg }
}

function pointer(el: Element, type: 'pointermove' | 'pointerleave', pointerType: string, clientX = 0, clientY = 200) {
  const event = new Event(type, { bubbles: type === 'pointermove' })
  Object.defineProperties(event, { pointerType: { value: pointerType }, clientX: { value: clientX }, clientY: { value: clientY } })
  act(() => { el.dispatchEvent(event) })
}

const lx = (svg: SVGSVGElement) => svg.style.getPropertyValue('--lx')
const markX = (svg: SVGSVGElement) => Number(/translate\(([-\d.]+),0\)/.exec(svg.querySelector('.sc-mark')!.getAttribute('transform')!)![1])

describe('TopicScene', () => {
  it('is decoration: aria-hidden, with the three layers', () => {
    const { svg } = mount('prob')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(['pl-far', 'pl-mid', 'pl-near'].every((c) => svg.querySelector(`.${c}`))).toBe(true)
  })

  it('leans toward a mouse across the slide and eases back on leave', () => {
    const { slide, svg } = mount('prob')
    pointer(slide, 'pointermove', 'mouse', 700)
    expect(lx(svg)).toBe('1')
    pointer(slide, 'pointermove', 'pen', 0)
    expect(lx(svg)).toBe('-1')
    pointer(slide, 'pointerleave', 'mouse')
    expect(lx(svg)).toBe('0')
  })

  it('ignores a finger: no lean, no highlight', () => {
    const { slide, svg } = mount('stats')
    pointer(slide, 'pointermove', 'touch', 450)
    expect(lx(svg)).toBe('')
    expect(svg.querySelector('.is-hot')).toBeNull()
    expect(svg.classList.contains('is-probing')).toBe(false)
  })

  it('does nothing on a slide that is not current', () => {
    const { slide, svg } = mount('prob', false)
    pointer(slide, 'pointermove', 'mouse', 500)
    expect(lx(svg)).toBe('')
  })

  it('Probability: the marker and the shaded area follow the pointer, then settle back to rest', () => {
    const { slide, svg } = mount('prob')
    const rest = markX(svg)
    const restShade = svg.querySelector('.sc-shade')!.getAttribute('d')
    pointer(slide, 'pointermove', 'mouse', 300 + 100)
    settle()
    expect(markX(svg)).toBeCloseTo(100, 0)
    expect(svg.querySelector('.sc-shade')!.getAttribute('d')).not.toBe(restShade)
    expect(svg.querySelector('.sc-shade')!.getAttribute('d')).toBe(BELL.area(-3.2, BELL.zOf(markX(svg))))
    pointer(slide, 'pointerleave', 'mouse')
    settle()
    expect(markX(svg)).toBeCloseTo(rest, 0)
    expect(svg.querySelector('.sc-shade')!.getAttribute('d')).toBe(restShade)
  })

  it('Hypothesis: the rejection tail turns blue only while the marker is inside it', () => {
    const { slide, svg } = mount('hyp')
    const hi = svg.querySelector('.sc-tail.hi')!
    const lo = svg.querySelector('.sc-tail.lo')!
    expect(hi.classList.contains('is-hit')).toBe(true) // rests inside the upper tail
    pointer(slide, 'pointermove', 'mouse', 300 + BELL.xOf(0))
    settle()
    expect(hi.classList.contains('is-hit')).toBe(false)
    expect(lo.classList.contains('is-hit')).toBe(false)
    pointer(slide, 'pointermove', 'mouse', 300 + BELL.xOf(-2.5))
    settle()
    expect(lo.classList.contains('is-hit')).toBe(true)
    pointer(slide, 'pointerleave', 'mouse')
    settle()
    expect(lo.classList.contains('is-hit')).toBe(false)
    expect(hi.classList.contains('is-hit')).toBe(true)
  })

  it('Statistics: the bar under the pointer is hot, its neighbours warm, and it clears on leave', () => {
    const { slide, svg } = mount('stats')
    const bars = Array.from(svg.querySelectorAll('.sc-bar'))
    const x = 24 + (292 / bars.length) * 5.5
    pointer(slide, 'pointermove', 'mouse', 300 + x)
    expect(bars.filter((b) => b.classList.contains('is-hot'))).toEqual([bars[5]])
    expect(bars.filter((b) => b.classList.contains('is-warm'))).toEqual([bars[4], bars[6]])
    expect(svg.classList.contains('is-probing')).toBe(true)
    pointer(slide, 'pointerleave', 'mouse')
    expect(svg.querySelector('.is-hot, .is-warm')).toBeNull()
    expect(svg.classList.contains('is-probing')).toBe(false)
  })

  it('Statistics: draws the bars of the loaded data, and a sample shape without it', () => {
    const loaded = [1, 2, 3, 10, 30, 60, 90, 60, 30, 10, 3, 2, 1]
    const { svg } = mount('stats', true, loaded)
    expect(svg.querySelectorAll('.sc-bar').length).toBe(sceneHist(loaded).bars.length)
    const heights = Array.from(svg.querySelectorAll('.sc-bar')).map((b) => b.getAttribute('d'))
    mount('stats', true)
    expect(Array.from(container.querySelectorAll('.sc-bar')).map((b) => b.getAttribute('d'))).not.toEqual(heights)
    expect(container.querySelectorAll('.sc-bar').length).toBe(22)
  })

  it('Regression: the nearest dot grows, and none when the pointer is far from every dot', () => {
    const { slide, svg } = mount('reg')
    const dots = Array.from(svg.querySelectorAll('.sc-dot'))
    pointer(slide, 'pointermove', 'mouse', 300 + REG_SCENE_DOTS[3][0] + 2)
    expect(dots.filter((d) => d.classList.contains('is-hot'))).toEqual([dots[3]])
    pointer(slide, 'pointermove', 'mouse', 300 + 5)
    expect(svg.querySelector('.sc-dot.is-hot')).toBeNull()
    pointer(slide, 'pointermove', 'mouse', 300 + REG_SCENE_DOTS[0][0])
    pointer(slide, 'pointerleave', 'mouse')
    expect(svg.querySelector('.sc-dot.is-hot')).toBeNull()
  })

  it('reduced motion: highlights still change, nothing leans, the marker does not glide', () => {
    reduced = true
    const { slide, svg } = mount('prob')
    pointer(slide, 'pointermove', 'mouse', 600)
    expect(lx(svg)).toBe('')
    settle()
    expect(markX(svg)).toBeCloseTo(300, 0)
    const stats = mount('stats')
    pointer(stats.slide, 'pointermove', 'mouse', 300 + 24 + 5)
    expect(stats.svg.querySelector('.sc-bar.is-hot')).not.toBeNull()
  })

  it('never re-renders on pointermove: the scene element and its marker node stay the same', () => {
    const { slide, svg } = mount('prob')
    const marker = svg.querySelector('.sc-mark')
    for (let i = 0; i < 10; i++) pointer(slide, 'pointermove', 'mouse', 320 + i * 20)
    settle()
    expect(container.querySelector('svg')).toBe(svg)
    expect(svg.querySelector('.sc-mark')).toBe(marker)
  })

  it('puts the scene back at rest when its slide stops being current', () => {
    const { slide, svg } = mount('prob')
    pointer(slide, 'pointermove', 'mouse', 640)
    settle()
    const moved = markX(svg)
    act(() => root.render(
      <article className="ct-slide">
        <TopicScene kind="prob" active={false} />
      </article>,
    ))
    expect(markX(svg)).toBeLessThan(moved)
    expect(markX(svg)).toBeCloseTo(BELL.xOf(0.8), 0)
    expect(lx(svg)).toBe('0')
    expect(SC.W).toBe(340)
  })
})
