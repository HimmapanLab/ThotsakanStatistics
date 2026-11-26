import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ROUTE_KEY, useHashRoute, usePreferencesOpen, type Route } from './routes'

let root: Root
let container: HTMLDivElement
let route: Route
let setRoute: (route: Route) => void
let prefsOpen: boolean
let setPrefsOpen: (open: boolean) => void

function Probe() {
  ;[route, setRoute] = useHashRoute()
  ;[prefsOpen, setPrefsOpen] = usePreferencesOpen()
  return null
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.history.replaceState(null, '', '/')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.history.replaceState(null, '', '/')
})

const hashChanged = () => act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')) })

describe('useHashRoute', () => {
  it('opens home on a first visit with no address', () => {
    act(() => root.render(<Probe />))
    expect(route).toBe('home')
  })

  it('follows the address and remembers the page', async () => {
    window.location.hash = '#hypothesis'
    act(() => root.render(<Probe />))
    expect(route).toBe('hypothesis')
    expect(localStorage.getItem(ROUTE_KEY)).toBe('hypothesis')
    act(() => setRoute('probability'))
    await hashChanged()
    expect(route).toBe('probability')
    expect(localStorage.getItem(ROUTE_KEY)).toBe('probability')
  })

  it('comes back to the remembered page when the address is empty', () => {
    localStorage.setItem(ROUTE_KEY, 'statistics-descriptive')
    act(() => root.render(<Probe />))
    expect(route).toBe('statistics-descriptive')
    expect(window.location.hash).toBe('#statistics-descriptive')
  })

  it('does not remember the Coming later page as the last page', async () => {
    window.location.hash = '#hypothesis'
    act(() => root.render(<Probe />))
    act(() => setRoute('regression'))
    await hashChanged()
    expect(route).toBe('regression')
    expect(localStorage.getItem(ROUTE_KEY)).toBe('hypothesis')
  })

  it('lets a link win over the remembered page', () => {
    localStorage.setItem(ROUTE_KEY, 'statistics-descriptive')
    window.location.hash = '#regression'
    act(() => root.render(<Probe />))
    expect(route).toBe('regression')
  })
})

describe('usePreferencesOpen', () => {
  it('opens Preferences over the current page and closes it back to that page', async () => {
    window.location.hash = '#probability'
    act(() => root.render(<Probe />))
    expect(prefsOpen).toBe(false)
    act(() => setPrefsOpen(true))
    await hashChanged()
    expect(prefsOpen).toBe(true)
    expect(route).toBe('probability')
    act(() => setPrefsOpen(false))
    expect(prefsOpen).toBe(false)
    expect(route).toBe('probability')
    expect(window.location.hash).toBe('#probability')
  })
})
