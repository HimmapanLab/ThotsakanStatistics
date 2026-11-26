import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawerProvider, useDrawer } from '../../context/DrawerContext'
import HomeTab from './HomeTab'

type Mock = { state: Record<string, unknown>; restoring: boolean }
const data: Mock = { state: {}, restoring: false }
vi.mock('../../context/DataContext', () => ({ useData: () => data }))

const computeGraph = vi.fn()
vi.mock('../../api/graphical', () => ({ graphicalApi: { computeGraph: (...args: unknown[]) => computeGraph(...args) } }))

const EMPTY = { dataset: null, filename: '', sessionId: null, status: 'idle', numericCols: [], categoricalCols: [] }
const LOADED = {
  dataset: { headers: ['ds', 'Demand', 'Region'], rows: new Array(17518).fill({}), numericCols: ['Demand'], categoricalCols: ['Region'] },
  filename: 'ElectricityDemand.csv', sessionId: 's1', status: 'ready', numericCols: ['Demand'], categoricalCols: ['Region'],
}

let root: Root
let container: HTMLDivElement

function DrawerProbe() {
  const { open } = useDrawer()
  return <output data-testid="drawer">{open ? 'open' : 'closed'}</output>
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  data.state = EMPTY
  data.restoring = false
  computeGraph.mockReset()
  computeGraph.mockResolvedValue({ histogram_data: { densities: [1, 5, 20, 40, 20, 5, 1] }, warnings: [] })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = (onNavigate = vi.fn()) => {
  act(() => root.render(<DrawerProvider><DrawerProbe /><HomeTab onNavigate={onNavigate} /></DrawerProvider>))
  return onNavigate
}
const text = () => container.textContent ?? ''

describe('HomeTab', () => {
  it('names the app in full and shows the logos, with no proposal badge or prototype footer', () => {
    render()
    expect(container.querySelector('h1')!.textContent).toBe('Thotsakan Statistics')
    expect(Array.from(container.querySelectorAll('.hm-logos img')).map((i) => i.getAttribute('alt'))).toEqual(['Himmapan', 'CMKL', 'AICE', 'Maiyarap Equations'])
    expect(text()).not.toMatch(/Proposal|Prototype for review/)
  })

  it('without data: Probability needs none, the others say they need data, and nothing is requested', () => {
    render()
    const fits = Array.from(container.querySelectorAll('.ct-slide')).map((s) => s.querySelector('.ct-fit')?.textContent ?? null)
    expect(fits).toEqual(['Works without data', 'Needs data', 'Needs data', null])
    expect(text()).toContain('No data loaded.')
    expect(computeGraph).not.toHaveBeenCalled()
  })

  it('with data: says which topics fit and asks the backend for the histogram of the first numeric column', async () => {
    data.state = LOADED
    await act(async () => { render() })
    expect(text()).toContain('ElectricityDemand.csv')
    expect(text()).toContain('17518 rows × 3 columns')
    const fits = Array.from(container.querySelectorAll('.ct-slide')).map((s) => s.querySelector('.ct-fit')?.textContent ?? null)
    expect(fits).toEqual(['Works without data', 'ElectricityDemand.csv fits', 'ElectricityDemand.csv fits', null])
    expect(computeGraph).toHaveBeenCalledTimes(1)
    expect(computeGraph.mock.calls[0][0]).toBe('s1')
    expect(computeGraph.mock.calls[0][1]).toMatchObject({ column: 'Demand', graph_type: 'Histogram' })
    expect(computeGraph.mock.calls[0][2]).toBeInstanceOf(AbortSignal)
  })

  it('with data but no group column the hypothesis slide names the tests that fit', async () => {
    data.state = { ...LOADED, categoricalCols: [] }
    await act(async () => { render() })
    expect(container.querySelectorAll('.ct-slide')[2].querySelector('.ct-fit')!.textContent).toBe('Fits the one-sample tests')
  })

  it('draws the bars of the loaded histogram, not the sample shape', async () => {
    const before = (() => { render(); return Array.from(container.querySelectorAll('.k-stats .sc-bar')).map((b) => b.getAttribute('d')) })()
    data.state = LOADED
    await act(async () => { render() })
    const after = Array.from(container.querySelectorAll('.k-stats .sc-bar')).map((b) => b.getAttribute('d'))
    expect(after.length).toBe(7)
    expect(after).not.toEqual(before)
  })

  it('keeps the sample shape when the backend fails, without an error on the page', async () => {
    data.state = LOADED
    computeGraph.mockRejectedValue(new Error('down'))
    await act(async () => { render() })
    expect(container.querySelectorAll('.k-stats .sc-bar').length).toBe(22)
  })

  it('Change data opens the drawer on a topic page', () => {
    data.state = LOADED
    const onNavigate = render()
    const change = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Change data')!
    act(() => change.click())
    expect(container.querySelector('[data-testid="drawer"]')!.textContent).toBe('open')
    expect(onNavigate).toHaveBeenCalledWith('statistics-graphical')
  })

  it('offers a Continue link back to the last topic, and none on a first visit', () => {
    render()
    expect(text()).not.toContain('Continue')
    act(() => root.unmount())
    root = createRoot(container)
    localStorage.setItem('tsl.route', 'hypothesis')
    const onNavigate = render()
    const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Continue: Hypothesis Testing')!
    expect(link.getAttribute('href')).toBe('#hypothesis')
    act(() => link.click())
    expect(onNavigate).toHaveBeenCalledWith('hypothesis')
    // the route store writes "home" next; the link survives
    localStorage.setItem('tsl.route', 'home')
    act(() => root.unmount())
    root = createRoot(container)
    render()
    expect(text()).toContain('Continue: Hypothesis Testing')
  })
})
