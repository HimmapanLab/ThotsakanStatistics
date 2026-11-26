import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Route } from '../app/routes'

const auth = vi.hoisted(() => ({ config: { enabled: false, demo: false, clientId: '', allowedDomain: '' } as { enabled: boolean; demo?: boolean; clientId: string; allowedDomain: string } | null }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), config: auth.config }),
}))
import Header, { MENU_CLOSE_DELAY, MENU_OPEN_DELAY } from './Header'

let root: Root
let container: HTMLDivElement
const onTour = vi.fn()

function render(route: Route) {
  act(() => root.render(<Header route={route} onTour={onTour} />))
}
const trigger = () => container.querySelector<HTMLButtonElement>('.tb-trigger')!
const menu = () => document.querySelector<HTMLElement>('.tm-pop')
const items = () => [...document.querySelectorAll<HTMLElement>('.tm-item')]

function pointer(el: Element, type: 'pointerover' | 'pointerout', pointerType: string, relatedTarget: Element | null = null) {
  const event = new MouseEvent(type, { bubbles: true, relatedTarget })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  act(() => { el.dispatchEvent(event) })
}
function key(el: Element, k: string) {
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })) })
}
function click(el: Element) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })) })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers()
  auth.config = { enabled: false, demo: false, clientId: '', allowedDomain: '' }
  onTour.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('top bar', () => {
  it('names the app in full and links the topics', () => {
    render('probability')
    expect(container.querySelector('.tb-brand')!.textContent).toBe('Thotsakan Statistics')
    const links = [...container.querySelectorAll('.tb-topics > a')].map((a) => [a.textContent, a.getAttribute('href')])
    expect(links).toEqual([['Probability', '#probability'], ['Hypothesis Testing', '#hypothesis'], ['Linear Regression', '#regression']])
    expect(container.querySelector('.tb-topics a[aria-current="page"]')!.textContent).toBe('Probability')
    expect(trigger().getAttribute('aria-current')).toBeNull()
  })

  it('marks Statistics as the current topic on each of its pages', () => {
    render('statistics-inference')
    expect(trigger().getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('.tb-topics a[aria-current="page"]')).toBeNull()
  })

  it('keeps the front page bar bare: no brand, topics or watermark, only the tour and Preferences', () => {
    render('home')
    expect(container.querySelector('.tb-brand')).toBeNull()
    expect(container.querySelector('.tb-wm')).toBeNull()
    expect(container.querySelector('a[href="#preferences"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Take the tour"]')).not.toBeNull()
  })

  it('puts the watermark on every other page, hidden from assistive technology', () => {
    render('hypothesis')
    expect(container.querySelector('.tb-wm')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows no Demo badge outside demo mode', () => {
    render('hypothesis')
    expect(container.textContent).not.toContain('Demo')
  })

  it('gives the dev badge a short form for a narrow bar, and keeps the full text for a screen reader', () => {
    render('probability')
    const badge = container.querySelector('.tb-badge.is-warn')!
    expect(badge.querySelector('.tb-long')!.textContent).toBe('Auth disabled (dev)')
    expect(badge.querySelector('.tb-short')!.textContent).toBe('Dev')
    expect(badge.querySelector('.tb-short')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the Demo badge in demo mode', () => {
    auth.config = { enabled: false, demo: true, clientId: '', allowedDomain: '' }
    render('hypothesis')
    expect(container.querySelector('.tb-badge')!.textContent).toBe('Demo')
  })

  it('starts the tour from its button', () => {
    render('hypothesis')
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Take the tour"]')!.click())
    expect(onTour).toHaveBeenCalledTimes(1)
  })
})

describe('Statistics menu', () => {
  it('opens after 120 ms of mouse hover, not before', () => {
    render('probability')
    pointer(trigger(), 'pointerover', 'mouse')
    act(() => { vi.advanceTimersByTime(MENU_OPEN_DELAY - 1) })
    expect(menu()).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(menu()).not.toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(items().map((a) => a.querySelector('.tm-name')!.textContent)).toEqual(['Graphical Analysis', 'Descriptive Statistics', 'Statistical Inference'])
    expect(items().map((a) => a.getAttribute('href'))).toEqual(['#statistics-graphical', '#statistics-descriptive', '#statistics-inference'])
  })

  it('does not open on a touch hover, and a short pass of the mouse does not open it', () => {
    render('probability')
    pointer(trigger(), 'pointerover', 'touch')
    act(() => { vi.advanceTimersByTime(500) })
    expect(menu()).toBeNull()
    pointer(trigger(), 'pointerover', 'mouse')
    act(() => { vi.advanceTimersByTime(50) })
    pointer(trigger(), 'pointerout', 'mouse', document.body)
    act(() => { vi.advanceTimersByTime(500) })
    expect(menu()).toBeNull()
  })

  it('closes 300 ms after the pointer leaves the button', () => {
    render('probability')
    pointer(trigger(), 'pointerover', 'mouse')
    act(() => { vi.advanceTimersByTime(MENU_OPEN_DELAY) })
    pointer(trigger(), 'pointerout', 'mouse', document.body)
    act(() => { vi.advanceTimersByTime(MENU_CLOSE_DELAY - 1) })
    expect(menu()).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(menu()).toBeNull()
  })

  it('stays open while the pointer is on the menu, and closes 300 ms after it leaves', () => {
    render('probability')
    pointer(trigger(), 'pointerover', 'mouse')
    act(() => { vi.advanceTimersByTime(MENU_OPEN_DELAY) })
    // the pointer moves from the button onto the menu
    pointer(trigger(), 'pointerout', 'mouse', menu())
    act(() => { vi.advanceTimersByTime(1000) })
    expect(menu()).not.toBeNull()
    pointer(menu()!, 'pointerout', 'mouse', document.body)
    act(() => { vi.advanceTimersByTime(MENU_CLOSE_DELAY) })
    expect(menu()).toBeNull()
  })

  it('opens on click and closes on a second click', () => {
    render('probability')
    click(trigger())
    expect(menu()).not.toBeNull()
    click(trigger())
    expect(menu()).toBeNull()
  })

  it('closes on Tab and moves on to the control after the button, not to the start of the page', () => {
    render('probability')
    const after = container.querySelector<HTMLElement>('.tb-topics > a[href="#hypothesis"]')!
    key(trigger(), 'ArrowDown')
    expect(menu()).not.toBeNull()
    key(document.activeElement!, 'Tab')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(after)
  })

  it('goes back to the button on Shift+Tab', () => {
    render('probability')
    key(trigger(), 'ArrowDown')
    act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it.each(['Enter', ' ', 'ArrowDown'])('opens on %j and moves focus to the current page, or the first item', (k) => {
    render('statistics-descriptive')
    act(() => trigger().focus())
    key(trigger(), k)
    expect(menu()).not.toBeNull()
    expect(document.activeElement).toBe(items()[1])
  })

  it('focuses the first item when the current page is not a Statistics page', () => {
    render('hypothesis')
    act(() => trigger().focus())
    key(trigger(), 'ArrowDown')
    expect(document.activeElement).toBe(items()[0])
  })

  it('moves with the arrows, wraps, and jumps with Home and End', () => {
    render('hypothesis')
    act(() => trigger().focus())
    key(trigger(), 'ArrowDown')
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(items()[1])
    key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(items()[2])
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(items()[2])
    key(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(items()[0])
  })

  it('closes on Esc and returns focus to the button', () => {
    render('hypothesis')
    act(() => trigger().focus())
    key(trigger(), 'ArrowDown')
    key(document.activeElement!, 'Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Esc even when it was opened by hover and focus never moved', () => {
    render('hypothesis')
    pointer(trigger(), 'pointerover', 'mouse')
    act(() => { vi.advanceTimersByTime(MENU_OPEN_DELAY) })
    key(document.body, 'Escape')
    expect(menu()).toBeNull()
  })

  it('closes when the page changes', () => {
    render('hypothesis')
    click(trigger())
    expect(menu()).not.toBeNull()
    render('statistics-graphical')
    expect(menu()).toBeNull()
  })

  it('closes on a press elsewhere', () => {
    render('hypothesis')
    click(trigger())
    act(() => { document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })) })
    expect(menu()).toBeNull()
  })
})
