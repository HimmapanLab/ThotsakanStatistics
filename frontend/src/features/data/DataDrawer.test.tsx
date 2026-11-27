import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider, useData } from '../../context/DataContext'
import { DrawerProvider, useDrawer } from '../../context/DrawerContext'
import DataDrawer from './DataDrawer'
import DataRail from './DataRail'

const haptic = vi.fn()
vi.mock('../../lib/haptics', () => ({ haptic: (kind: string) => haptic(kind) }))
vi.mock('../../api/client', () => ({
  uploadCsv: vi.fn().mockResolvedValue('session-1'),
  liveSessionId: (id: string) => id,
  resetSessionAliases: vi.fn(),
  setSessionRenewer: vi.fn(),
}))

// 8 rows: a timestamp (near-unique text), a group, a measurement and a count (synthetic data)
const CSV = [
  'ts,group,score,count',
  ...Array.from({ length: 8 }, (_, i) =>
    `2024-01-0${i + 1}T00:00,${i < 5 ? 'a' : 'b'},${(10 - i * 1.5).toFixed(1)},${i}`),
].join('\n')

let root: Root
let container: HTMLDivElement
let api: ReturnType<typeof useData>
let drawer: ReturnType<typeof useDrawer>

function Probe() {
  const data = useData()
  const d = useDrawer()
  useEffect(() => { api = data; drawer = d })
  return null
}

function DrawerSwitch() {
  const { open } = useDrawer()
  return open ? <DataDrawer /> : null
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  haptic.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(
    <DataProvider>
      <DrawerProvider>
        <DataRail />
        <DrawerSwitch />
        <Probe />
      </DrawerProvider>
    </DataProvider>,
  ))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function loadCsv() {
  // Two renders, as in the browser: "loading" shows first, then the data.
  let done: Promise<boolean> = Promise.resolve(false)
  await act(async () => { done = api.loadFile(new File([CSV], 'sample.csv', { type: 'text/csv' })) })
  await act(async () => { await done })
}
const rail = () => container.querySelector<HTMLButtonElement>('.data-rail-btn')!
const typeTag = (col: string) => container.querySelector<HTMLButtonElement>(`button[aria-label^="Column type of ${col}:"]`)!
const bodyTexts = (colIndex: number) =>
  Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.children[colIndex].textContent)

describe('Data rail and drawer', () => {
  it('opens from the rail, moves focus into the drawer, and gives it back on Escape', async () => {
    expect(container.querySelector('.data-drawer')).toBeNull()
    expect(rail().getAttribute('aria-expanded')).toBe('false')
    rail().focus()
    await act(async () => rail().click())
    expect(rail().getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.data-rail')!.classList.contains('is-open')).toBe(true)
    const drawerEl = container.querySelector('.data-drawer')!
    expect(drawerEl).not.toBeNull()
    expect(document.activeElement).toBe(drawerEl.querySelector('button[aria-label="Close Data"]'))
    await act(async () => { drawerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(container.querySelector('.data-drawer')).toBeNull()
    expect(document.activeElement).toBe(rail())
  })

  it('closes with the Close button and focuses the rail', async () => {
    await act(async () => rail().click())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Close Data"]')!.click())
    expect(drawer.open).toBe(false)
    expect(document.activeElement).toBe(rail())
  })

  it('shows the dataset and its size on the rail and says "data loaded"', async () => {
    expect(container.querySelector('.data-rail-vert')!.textContent).toBe('No data')
    await loadCsv()
    expect(container.querySelector('.data-rail-vert')!.textContent).toMatch(/· 8 rows$/)
    expect(container.querySelector('[role="status"]')!.textContent).toMatch(/^Data loaded: .*8 rows\.$/)
  })

  it('warns beside the data when a file has one column that holds semicolons', async () => {
    let done: Promise<boolean> = Promise.resolve(false)
    await act(async () => { done = api.loadFile(new File(['a;b\n1;2\n'], 'semi.csv', { type: 'text/csv' })) })
    await act(async () => { await done })
    await act(async () => rail().click())
    const notes = Array.from(container.querySelectorAll('.data-note')).map((el) => el.textContent)
    expect(notes).toContain('This file has one column. Its values look separated by semicolons or tabs, but only commas are read. In Excel, save it as "CSV UTF-8" (comma delimited).')
  })

  it('shows plain advice, not library text, for a file with no columns', async () => {
    let done: Promise<boolean> = Promise.resolve(true)
    await act(async () => { done = api.loadFile(new File([''], 'empty.csv', { type: 'text/csv' })) })
    await act(async () => { await done })
    expect(await done).toBe(false)
    await act(async () => rail().click())
    expect(container.querySelector('.data-note-error')!.textContent).toBe('This file has no columns. Check it is a CSV with a header row.')
  })

  it('guesses a timestamp column as ID and keeps numericCols and categoricalCols per the contract', async () => {
    await loadCsv()
    expect(api.state.columnTypes).toEqual({ ts: 'ID', group: 'Nominal', score: 'Continuous', count: 'Discrete' })
    expect(api.state.numericCols).toEqual(['score', 'count'])
    expect(api.state.categoricalCols).toEqual(['group'])
  })

  it('sorts the whole set by a column header, ascending then descending', async () => {
    await loadCsv()
    await act(async () => rail().click())
    const th = Array.from(container.querySelectorAll('thead th')).find((el) => el.textContent?.includes('score'))!
    await act(async () => th.querySelector<HTMLButtonElement>('.data-th-name')!.click())
    expect(th.getAttribute('aria-sort')).toBe('ascending')
    expect(bodyTexts(3)).toEqual(['-0.5', '1.0', '2.5', '4.0', '5.5', '7.0', '8.5', '10.0'])
    await act(async () => th.querySelector<HTMLButtonElement>('.data-th-name')!.click())
    expect(th.getAttribute('aria-sort')).toBe('descending')
    expect(bodyTexts(3)[0]).toBe('10.0')
  })

  it('applies a filter, shows "Filtered n of N" and confirms by haptic', async () => {
    await loadCsv()
    await act(async () => rail().click())
    const filter = Array.from(container.querySelectorAll<HTMLButtonElement>('.data-tools button'))
      .find((b) => b.textContent?.includes('Filter') && !b.textContent.includes('Clear'))!
    await act(async () => filter.click())
    const apply = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Apply')!
    await act(async () => apply.click())
    expect(haptic).toHaveBeenCalledWith('confirm')
    expect(container.querySelector('.lab-chip-filter')!.textContent).toBe('Filtered 5 of 8')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5)
    const clear = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Clear filter')!
    await act(async () => clear.click())
    expect(container.querySelector('.lab-chip-filter')).toBeNull()
  })

  it('greys out a type the values do not fit, shows the reason, and refuses by haptic on a tap', async () => {
    await loadCsv()
    await act(async () => rail().click())
    await act(async () => typeTag('group').click())
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.data-typeopt'))
    const continuous = options.find((o) => o.textContent?.includes('Continuous'))!
    expect(continuous.getAttribute('aria-disabled')).toBe('true')
    expect(continuous.textContent).toContain('Fewer than 80% of the values are numbers.')
    await act(async () => continuous.click())
    expect(haptic).toHaveBeenCalledWith('refuse')
    expect(api.state.columnTypes.group).toBe('Nominal')
  })

  it('changes a type that fits, updates the two lists, and can undo it', async () => {
    await loadCsv()
    await act(async () => rail().click())
    await act(async () => typeTag('count').click())
    const ordinal = Array.from(document.querySelectorAll<HTMLButtonElement>('.data-typeopt')).find((o) => o.textContent?.includes('Ordinal'))!
    await act(async () => ordinal.click())
    expect(api.state.columnTypes.count).toBe('Ordinal')
    expect(api.state.numericCols).toEqual(['score'])
    expect(api.state.categoricalCols).toEqual(['group', 'count'])
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Undo type change"]')!.click())
    expect(api.state.columnTypes.count).toBe('Discrete')
  })
})
