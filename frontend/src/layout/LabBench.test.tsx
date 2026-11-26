import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataProvider } from '../context/DataContext'
import { DrawerProvider, useDrawer } from '../context/DrawerContext'
import LabBench from './LabBench'
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
        <LabBench route={route} controls={<input aria-label="Draft setting" defaultValue="original" />} observation={<p>Observation</p>} />
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

const state = () => container.querySelector('[data-testid="open"]')!.textContent
const inputs = () => container.querySelector<HTMLElement>('#inputs-panel')!

describe('page head', () => {
  it('shows "Statistics ›" above a title naming the sub-topic', () => {
    render('statistics-descriptive')
    const crumb = container.querySelector('.pagehead-crumb')!
    expect(crumb.textContent).toBe('Statistics ›')
    expect(crumb.querySelector('a')!.getAttribute('href')).toBe('#statistics-graphical')
    expect(container.querySelector('h1')!.textContent).toBe('Descriptive Statistics')
    expect(container.querySelector('h1')!.getAttribute('tabindex')).toBe('-1')
  })

  it('has no crumb for a topic that is not under Statistics', () => {
    render('hypothesis')
    expect(container.querySelector('.pagehead-crumb')).toBeNull()
    expect(container.querySelector('h1')!.textContent).toBe('Hypothesis Testing')
  })

  it('leaves no sub-tab bar behind', () => {
    render('statistics-graphical')
    expect(container.querySelector('nav[aria-label="Analysis navigation"]')).toBeNull()
  })
})

describe('bench', () => {
  it('holds the Data rail, the inputs and the results, in that order', () => {
    render('hypothesis')
    const cells = [...container.querySelectorAll('.bench > *')].map((el) => el.className.split(' ')[0])
    expect(cells).toEqual(['bench-rail', 'bench-inputs', 'bench-output'])
    expect(container.querySelector('.bench-output')!.textContent).toBe('Observation')
  })

  it('swaps the inputs for the Data drawer while it is open, and keeps what was typed', () => {
    render('hypothesis')
    const field = container.querySelector('input')!
    field.value = 'unfinished draft'
    act(() => container.querySelector<HTMLButtonElement>('.bench-rail button')!.click())
    expect(state()).toBe('open')
    expect(container.querySelector('.bench-drawer')).not.toBeNull()
    expect(inputs().hidden).toBe(true)
    expect(container.querySelector('.bench')!.classList.contains('is-drawer')).toBe(true)
    act(() => container.querySelector<HTMLButtonElement>('.bench-rail button')!.click())
    expect(state()).toBe('closed')
    expect(container.querySelector('.bench-drawer')).toBeNull()
    expect(inputs().hidden).toBe(false)
    expect(container.querySelector('input')).toBe(field)
    expect(field.value).toBe('unfinished draft')
  })

  it('closes the drawer on Esc and puts focus back on the rail', () => {
    render('hypothesis', true)
    expect(state()).toBe('open')
    act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(state()).toBe('closed')
    expect(document.activeElement).toBe(container.querySelector('.bench-rail button'))
  })

  it('leaves Esc to a popover that already used it', () => {
    render('hypothesis', true)
    const used = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    used.preventDefault()
    act(() => { document.body.dispatchEvent(used) })
    expect(state()).toBe('open')
  })
})
