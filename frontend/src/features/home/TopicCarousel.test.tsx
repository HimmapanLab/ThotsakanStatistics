import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHaptics, trackInput } from '../../lib/haptics'
import TopicCarousel, { SLIDE_KEY } from './TopicCarousel'

let root: Root
let container: HTMLDivElement
let vibrate: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrate })
  resetHaptics()
  trackInput()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  delete (navigator as { vibrate?: unknown }).vibrate
  vi.useRealTimers()
})

const render = (onNavigate = vi.fn()) => {
  act(() => root.render(<TopicCarousel onNavigate={onNavigate} fitFor={() => <span className="ct-fit none">fit line</span>} />))
  return onNavigate
}
const slides = () => Array.from(container.querySelectorAll<HTMLElement>('.ct-slide'))
const currentName = () => container.querySelector('.ct-slide.is-current h2')!.textContent
const tab = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('.ct-tab')).find((b) => b.textContent === name)!
const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const live = () => container.querySelector('[data-testid="ct-live"]')!.textContent
const keydown = (key: string, target: Element = container.querySelector('.ct-tab')!) =>
  act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
function touchPress() {
  const event = new Event('pointerdown', { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  window.dispatchEvent(event)
}

describe('TopicCarousel', () => {
  it('shows four slides, starts on Statistics and offers one named tab per topic', () => {
    render()
    expect(slides().map((s) => s.querySelector('h2')!.textContent)).toEqual(['Probability', 'Statistics', 'Hypothesis Testing', 'Linear Regression'])
    expect(currentName()).toBe('Statistics')
    expect(Array.from(container.querySelectorAll('.ct-tab')).map((b) => b.textContent)).toEqual(['Probability', 'Statistics', 'Hypothesis Testing', 'Linear Regression'])
    expect(tab('Statistics').getAttribute('aria-current')).toBe('true')
    expect(slides()[0].getAttribute('aria-hidden')).toBe('true')
    expect(slides()[1].getAttribute('aria-hidden')).toBeNull()
  })

  it('moves with the named tabs and the arrow buttons, and stops at both ends', () => {
    render()
    act(() => tab('Hypothesis Testing').click())
    expect(currentName()).toBe('Hypothesis Testing')
    act(() => button('Next topic').click())
    expect(currentName()).toBe('Linear Regression')
    expect(button('Next topic').disabled).toBe(true)
    act(() => button('Previous topic').click())
    expect(currentName()).toBe('Hypothesis Testing')
    act(() => tab('Probability').click())
    expect(button('Previous topic').disabled).toBe(true)
  })

  it('moves with ArrowRight, ArrowLeft, Home and End, and leaves keys typed in a field alone', () => {
    render()
    keydown('ArrowRight')
    expect(currentName()).toBe('Hypothesis Testing')
    keydown('ArrowLeft')
    keydown('ArrowLeft')
    expect(currentName()).toBe('Probability')
    keydown('End')
    expect(currentName()).toBe('Linear Regression')
    keydown('Home')
    expect(currentName()).toBe('Probability')
    const field = document.createElement('input')
    container.querySelector('.ct')!.appendChild(field)
    keydown('End', field)
    expect(currentName()).toBe('Probability')
  })

  it('never moves on its own', () => {
    vi.useFakeTimers()
    render()
    act(() => { vi.advanceTimersByTime(120_000) })
    expect(currentName()).toBe('Statistics')
  })

  it('remembers the last slide and starts there next time', () => {
    render()
    act(() => tab('Hypothesis Testing').click())
    expect(localStorage.getItem(SLIDE_KEY)).toBe('2')
    act(() => root.unmount())
    root = createRoot(container)
    render()
    expect(currentName()).toBe('Hypothesis Testing')
  })

  it('ignores a remembered slide that does not exist', () => {
    localStorage.setItem(SLIDE_KEY, '9')
    render()
    expect(currentName()).toBe('Statistics')
  })

  it('announces a change of slide politely, and says nothing on first show', () => {
    render()
    expect(live()).toBe('')
    expect(container.querySelector('[data-testid="ct-live"]')!.getAttribute('aria-live')).toBe('polite')
    act(() => tab('Probability').click())
    expect(live()).toBe('Probability, 1 of 4')
  })

  it('brings in a peeking neighbour when it is clicked', () => {
    render()
    act(() => slides()[2].click())
    expect(currentName()).toBe('Hypothesis Testing')
  })

  it('opens a topic from its button, and the Regression slide only says Coming later', () => {
    const onNavigate = render()
    const open = container.querySelector<HTMLAnchorElement>('.ct-slide.is-current a.ct-go')!
    expect(open.getAttribute('href')).toBe('#statistics-graphical')
    expect(open.tabIndex).toBe(0)
    act(() => open.click())
    expect(onNavigate).toHaveBeenCalledWith('statistics-graphical')
    const later = slides()[3]
    expect(later.querySelector('a')).toBeNull()
    expect(later.textContent).toContain('Coming later')
    expect(slides()[0].querySelector('a.ct-go')!.getAttribute('tabindex')).toBe('-1')
  })

  it('ticks on a touch snap only, never for the mouse or the keyboard', () => {
    render()
    act(() => tab('Probability').click())
    keydown('ArrowRight')
    expect(vibrate).not.toHaveBeenCalled()
    touchPress()
    act(() => tab('Hypothesis Testing').click())
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(8)
  })

  it('does not tick when the slide does not change', () => {
    render()
    touchPress()
    act(() => tab('Statistics').click())
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('draws every scene aria-hidden', () => {
    render()
    const scenes = container.querySelectorAll('svg.ct-scene')
    expect(scenes.length).toBe(4)
    scenes.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'))
  })
})
