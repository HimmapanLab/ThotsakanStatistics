import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawerProvider } from './context/DrawerContext'
import { forgetTourSeen, markTourSeen } from './components/Tour'
import App from './App'

// The pages and the bar are not the subject here: stand-ins that keep what App's route and tour code touches.
vi.mock('./layout/Header', () => ({ default: ({ onTour }: { onTour: () => void }) => <button data-testid="start-tour" onClick={onTour}>Tour</button> }))
vi.mock('./layout/LabBench', () => ({ default: ({ route }: { route: string }) => <main className="bench-output"><h1 tabIndex={-1}>{route}</h1></main> }))
vi.mock('./features/home/HomeTab', () => ({ default: () => <h1 tabIndex={-1}>Home</h1> }))
const data = vi.hoisted(() => ({
  state: { status: 'idle', sessionId: '', filename: '', dataset: null, numericCols: [] as string[], categoricalCols: [] as string[], profiles: {}, filters: {}, displayPrecision: 3, notice: null },
  filteredRows: [] as Record<string, string>[], getUniqueValues: () => [] as string[],
}))
vi.mock('./context/DataContext', () => ({ useData: () => data }))
const dist = vi.hoisted(() => ({ result: null, isLoading: false, error: null, retry: () => {}, appliedParams: null }))
vi.mock('./hooks/useDistribution', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks/useDistribution')>()),
  useDistribution: () => dist,
}))

let root: Root
let container: HTMLDivElement
const later = (ms = 60) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })
const go = async (hash: string) => { await act(async () => { window.location.hash = hash }); await later() }
const coach = () => document.querySelector('.tour-coach')

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  forgetTourSeen()
  window.history.replaceState(null, '', '#home')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  forgetTourSeen()
})

const mount = async () => { await act(async () => root.render(<DrawerProvider><App /></DrawerProvider>)); await later() }

describe('the tour and the page', () => {
  it('closes the tour when the reader moves to another page, and does not count it as finished', async () => {
    await go('#statistics-graphical')
    await mount()
    expect(coach()).not.toBeNull()
    await go('#hypothesis')
    expect(coach()).toBeNull()
    expect(localStorage.getItem('tsl.tour')).toBeNull()
  })

  it('keeps the focus on the tour card or the Preferences sheet when the page changes under it', async () => {
    markTourSeen() // no tour of its own here
    await mount()
    for (const holder of ['tour-coach', 'sh-sheet']) {
      const card = document.createElement('div')
      card.className = holder
      card.innerHTML = '<button>Next</button>'
      document.body.append(card)
      card.querySelector('button')!.focus()
      await go(holder === 'sh-sheet' ? '#hypothesis' : '#probability')
      expect(document.activeElement).toBe(card.querySelector('button'))
      card.remove()
    }
  })

  it('starts the tour from the front page on the page it goes to', async () => {
    await mount()
    act(() => document.querySelector<HTMLButtonElement>('[data-testid="start-tour"]')!.click())
    await later(100)
    expect(coach()).not.toBeNull()
    expect(document.activeElement?.closest('.tour-coach')).not.toBeNull()
  })
})
