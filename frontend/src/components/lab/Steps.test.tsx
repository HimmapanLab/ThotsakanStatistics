import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawerProvider, useDrawer } from '../../context/DrawerContext'
import GatePrompt from './GatePrompt'
import LockedStep from './LockedStep'
import ResultsHead from './ResultsHead'
import StepBox from './StepBox'

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    state: { dataset: { rows: new Array(165) }, filename: 'whr.csv', filters: { year: ['2023'] } },
    filteredRows: new Array(40),
  }),
}))
import DataStep from './DataStep'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function DrawerState() {
  const { open } = useDrawer()
  return <output data-testid="drawer">{open ? 'open' : 'closed'}</output>
}

describe('step boxes', () => {
  it('number a step and name it by its heading', () => {
    act(() => root.render(<StepBox n={2} title="What to show"><p>body</p></StepBox>))
    const section = container.querySelector('section')!
    expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h2')!.id)
    expect(section.querySelector('h2')!.textContent).toBe('What to show')
    expect(section.querySelector('.lab-step-num')!.textContent).toBe('2')
    expect(section.className).not.toContain('is-new')
  })

  it('animate only a step that has just appeared, and announce it', async () => {
    vi.useFakeTimers()
    act(() => root.render(<StepBox n={2} title="What to show" isNew />))
    expect(container.querySelector('section')!.className).toContain('is-new')
    const status = container.querySelector('[role="status"]')!
    expect(status.textContent).toBe('')
    await act(async () => { vi.advanceTimersByTime(80) })
    expect(status.textContent).toBe('Step 2 opened')
    vi.useRealTimers()
  })

  it('show a locked step as a header with no controls, saying what opens it', () => {
    act(() => root.render(<LockedStep n={3} title="Settings" />))
    const section = container.querySelector('section')!
    expect(section.getAttribute('aria-disabled')).toBe('true')
    expect(section.textContent).toContain('Settings')
    expect(section.textContent).toContain('opens after step 2')
    expect(section.querySelector('button, input, select')).toBeNull()
  })

  it('names the step that opens it, which steps 2 and 3 share when they open together', () => {
    act(() => root.render(<LockedStep n={3} title="Settings" after={1} />))
    expect(container.querySelector('section')!.textContent).toContain('opens after step 1')
  })
})

describe('DataStep', () => {
  it('names the dataset, shows "Filtered n of N" and opens the drawer from Change', () => {
    act(() => root.render(<DrawerProvider><DataStep /><DrawerState /></DrawerProvider>))
    expect(container.querySelector('strong')!.textContent).toBe('whr.csv')
    expect(container.querySelector('.lab-chip-filter')!.textContent).toBe('Filtered 40 of 165')
    expect(container.querySelector('[data-testid="drawer"]')!.textContent).toBe('closed')
    act(() => (container.querySelector('button') as HTMLButtonElement).click())
    expect(container.querySelector('[data-testid="drawer"]')!.textContent).toBe('open')
  })
})

describe('results head and gate prompt', () => {
  it('keeps only what follows "Topic · " in the results heading', () => {
    act(() => root.render(<ResultsHead title="Graphical Analysis · Histogram" />))
    expect(container.querySelector('h2')!.textContent).toBe('Histogram')
  })

  it('says what to do before a variable is picked', () => {
    act(() => root.render(<GatePrompt text="Choose the column you want to look at." />))
    const prompt = container.querySelector('[role="status"]')!
    expect(prompt.querySelector('h2')!.textContent).toBe('Pick a variable to start')
    expect(prompt.textContent).toContain('Choose the column you want to look at.')
  })
})
