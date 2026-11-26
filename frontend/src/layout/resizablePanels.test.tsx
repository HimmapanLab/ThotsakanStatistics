import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataProvider } from '../context/DataContext'
import { DrawerProvider, useDrawer } from '../context/DrawerContext'
import LabBench from './LabBench'
import { LAYOUT_KEY, PANEL_LIMITS, clampWidth, loadWidths, panelRange } from './benchLayout'
import type { Route } from '../app/routes'

let root: Root
let container: HTMLDivElement

function Probe() {
  const { open } = useDrawer()
  return <output data-testid="open">{open ? 'open' : 'closed'}</output>
}

function render(route: Route, initialOpen = false) {
  act(() => root.render(
    <DataProvider>
      <DrawerProvider initialOpen={initialOpen}>
        <LabBench route={route} controls={<p>Inputs</p>} observation={<p>Results</p>} />
        <Probe />
      </DrawerProvider>
    </DataProvider>,
  ))
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const splitter = () => container.querySelector<HTMLElement>('[role="separator"]')!
const panelWidth = () => container.querySelector<HTMLElement>('.bench')!.style.getPropertyValue('--panel-w')
const press = (key: string, shiftKey = false) => act(() => {
  splitter().dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
})

describe('panel width limits', () => {
  it('keeps each panel inside its own limits', () => {
    expect(clampWidth('inputs', 100, 2000, 420)).toBe(PANEL_LIMITS.inputs.min)
    expect(clampWidth('inputs', 900, 2000, 420)).toBe(PANEL_LIMITS.inputs.max)
    expect(clampWidth('drawer', 2000, 3000, 420)).toBe(PANEL_LIMITS.drawer.max)
  })
  it('never squeezes the results under their minimum', () => {
    // 1000 px of room, results need 420: Data can take at most 580.
    expect(panelRange('drawer', 1000, 420)).toEqual({ min: 300, max: 580 })
    expect(clampWidth('drawer', 900, 1000, 420)).toBe(580)
  })
  it('reads saved widths, and falls back to the defaults on a bad value', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ inW: 400, drW: 'wide' }))
    expect(loadWidths()).toEqual({ inputs: 400, drawer: PANEL_LIMITS.drawer.def })
    localStorage.setItem(LAYOUT_KEY, '{not json')
    expect(loadWidths()).toEqual({ inputs: PANEL_LIMITS.inputs.def, drawer: PANEL_LIMITS.drawer.def })
  })
})

describe('the splitter', () => {
  it('resizes the inputs with the arrow keys and saves the width', () => {
    render('statistics-graphical')
    expect(splitter().getAttribute('aria-label')).toBe('Resize Inputs panel')
    expect(panelWidth()).toBe('320px')
    press('ArrowRight')
    expect(panelWidth()).toBe('336px')
    press('ArrowRight', true)
    expect(panelWidth()).toBe('400px')
    press('End')
    expect(panelWidth()).toBe(`${PANEL_LIMITS.inputs.max}px`)
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!).inW).toBe(PANEL_LIMITS.inputs.max)
    act(() => { splitter().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(panelWidth()).toBe(`${PANEL_LIMITS.inputs.def}px`)
  })
  it('resizes Data while it is open, with its own width', () => {
    render('statistics-graphical', true)
    expect(splitter().getAttribute('aria-label')).toBe('Resize Data panel')
    expect(splitter().getAttribute('aria-controls')).toBe('data-panel')
    press('Home')
    expect(panelWidth()).toBe(`${PANEL_LIMITS.drawer.min}px`)
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toMatchObject({ drW: PANEL_LIMITS.drawer.min, inW: PANEL_LIMITS.inputs.def })
  })
})

describe('Probability needs no data', () => {
  it('greys the Data tab out and does not open Data from it', () => {
    render('probability')
    const rail = container.querySelector<HTMLElement>('.data-rail')!
    expect(rail.classList.contains('is-disabled')).toBe(true)
    expect(rail.querySelector('button')!.getAttribute('aria-disabled')).toBe('true')
    act(() => rail.click())
    expect(container.querySelector('[data-testid="open"]')!.textContent).toBe('closed')
  })
  it('closes Data if it was open when Probability shows', () => {
    render('probability', true)
    expect(container.querySelector('[data-testid="open"]')!.textContent).toBe('closed')
  })
  it('keeps the Data tab working on the other pages', () => {
    render('hypothesis')
    const rail = container.querySelector<HTMLElement>('.data-rail')!
    expect(rail.classList.contains('is-disabled')).toBe(false)
    act(() => rail.click())
    expect(container.querySelector('[data-testid="open"]')!.textContent).toBe('open')
  })
})
