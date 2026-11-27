import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider, RESTORE_TIMEOUT_MS, useData } from './DataContext'
import { postJson, resetSessionAliases } from '../api/client'
import { PAGE_STATE_KEY, savePageState } from '../lib/pageState'
import { COLUMN_TYPES_KEY, SESSION_KEY, loadSession, memoryCsvStore, saveSession, setCsvStore, type CsvStore } from '../lib/sessionStore'

vi.mock('../utils/parseFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/parseFile')>()
  // PapaParse's worker is not available in jsdom; parse the small test CSVs directly.
  return {
    ...real,
    parseFile: async (file: File) => {
      if (file.name === 'empty.csv') throw new Error('This file has no columns.')
      const [header, ...lines] = (await file.text()).trim().split('\n')
      const headers = header.split(',')
      const rows = lines.map((line) => Object.fromEntries(line.split(',').map((cell, i) => [headers[i], cell])))
      return { headers, rows, numericCols: headers, categoricalCols: [] }
    },
  }
})

const A = 'a1,a2\n1,2\n3,4\n'
const B = 'b1,b2\n5,6\n7,8\n'
let root: Root
let container: HTMLDivElement
let api: ReturnType<typeof useData>
let store: CsvStore
let fetchMock: ReturnType<typeof vi.fn>
function Probe() { api = useData(); return <p>app</p> }
const mount = async () => { await act(async () => root.render(<DataProvider><Probe /></DataProvider>)) }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const LOST = () => new Response(JSON.stringify({ detail: 'Session expired or not found. Please upload the dataset again.' }), { status: 404 })
const session = (id: string) => new Response(JSON.stringify({ session_id: id }))

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  resetSessionAliases()
  store = memoryCsvStore()
  setCsvStore(store)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a session renewal that finishes late (H2)', () => {
  async function startRenewalOfA() {
    await store.put(A)
    saveSession({ sessionId: 'old', filename: 'a.csv', exampleKey: null })
    await mount()
    await settle()
    let finishRenewal!: (r: Response) => void
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/x') return Promise.resolve(LOST())
      // The first upload is the renewal of A; any later one answers at once.
      return new Promise<Response>((resolve) => {
        if (!finishRenewal) finishRenewal = resolve
        else resolve(session('b-session'))
      })
    })
    const call = postJson('/api/x', {}, { sessionId: 'old' }).catch(() => null)
    await settle() // the renewal upload of A is now pending
    return { call, finishRenewal: () => finishRenewal }
  }

  it('does not save the old file’s session id under a file loaded in the meantime', async () => {
    const { call, finishRenewal } = await startRenewalOfA()
    await act(async () => { await api.loadFile(new File([B], 'b.csv')) })
    expect(api.state).toMatchObject({ filename: 'b.csv', sessionId: 'b-session' })
    await act(async () => { finishRenewal()(session('a-renewed')); await settle() })
    await call
    expect(loadSession()).toMatchObject({ filename: 'b.csv', sessionId: 'b-session' })
  })

  it('does not bring the saved session back after Clear data', async () => {
    const { call, finishRenewal } = await startRenewalOfA()
    await act(async () => api.clearData())
    expect(loadSession()).toBeNull()
    await act(async () => { finishRenewal()(session('a-renewed')); await settle() })
    await call
    expect(loadSession()).toBeNull()
  })
})

describe('overlapping loads (H3)', () => {
  it('keeps the file asked for last, however the uploads finish', async () => {
    await mount()
    const done: Array<(r: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { done.push(resolve) }))
    let first!: Promise<boolean>
    let second!: Promise<boolean>
    await act(async () => {
      first = api.loadFile(new File([A], 'a.csv'))
      await settle() // the first file is read and its upload is under way
      second = api.loadFile(new File([B], 'b.csv'))
      await settle()
    })
    await act(async () => { done[1](session('sb')); expect(await second).toBe(true) })
    await act(async () => { done[0](session('sa')); expect(await first).toBe(false) })
    expect(api.state).toMatchObject({ filename: 'b.csv', sessionId: 'sb', status: 'ready' })
    expect(loadSession()).toMatchObject({ filename: 'b.csv', sessionId: 'sb' })
  })

  it('does not let an earlier load that fails late break a good one', async () => {
    await mount()
    const done: Array<(r: Response) => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { done.push(resolve) }))
    let first!: Promise<boolean>
    let second!: Promise<boolean>
    await act(async () => {
      first = api.loadFile(new File([A], 'a.csv'))
      await settle() // the first file is read and its upload is under way
      second = api.loadFile(new File([B], 'b.csv'))
      await settle()
    })
    await act(async () => { done[1](session('sb')); await second })
    await act(async () => { done[0](new Response('', { status: 400 })); await first })
    expect(api.state).toMatchObject({ filename: 'b.csv', status: 'ready', errorMsg: '', loadError: '' })
  })

  it('drops a load that finishes after Clear data', async () => {
    await mount()
    let finish!: (r: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
    let pending!: Promise<boolean>
    await act(async () => { pending = api.loadFile(new File([A], 'a.csv')); await settle() })
    await act(async () => api.clearData())
    await act(async () => { finish(session('sa')); expect(await pending).toBe(false) })
    expect(api.state).toMatchObject({ status: 'idle', dataset: null })
    expect(loadSession()).toBeNull()
  })
})

describe('a load that fails (H4)', () => {
  it('keeps the data already loaded usable and says why beside it', async () => {
    await mount()
    fetchMock.mockResolvedValueOnce(session('sa'))
    await act(async () => { await api.loadFile(new File([A], 'a.csv')) })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'The file is empty.' }), { status: 400 }))
    await act(async () => { expect(await api.loadFile(new File([B], 'b.csv'))).toBe(false) })
    expect(api.state).toMatchObject({ status: 'ready', filename: 'a.csv', sessionId: 'sa', loadError: 'The file is empty.', errorMsg: '' })
    expect(api.state.dataset).not.toBeNull()
    expect(loadSession()).toMatchObject({ filename: 'a.csv', sessionId: 'sa' })
    // The next successful load clears the message.
    fetchMock.mockResolvedValueOnce(session('sb'))
    await act(async () => { await api.loadFile(new File([B], 'b.csv')) })
    expect(api.state).toMatchObject({ filename: 'b.csv', loadError: '' })
  })

  it('reads the file before uploading it: a file that cannot be read is never sent, and its own message is shown', async () => {
    await mount()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'pandas: EmptyDataError' }), { status: 400 }))
    await act(async () => { expect(await api.loadFile(new File([''], 'empty.csv'))).toBe(false) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(api.state).toMatchObject({ status: 'error', errorMsg: 'This file has no columns.' })
  })

  it('is an error state when there was no data before', async () => {
    await mount()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'The file is empty.' }), { status: 400 }))
    await act(async () => { await api.loadFile(new File([A], 'a.csv')) })
    expect(api.state).toMatchObject({ status: 'error', errorMsg: 'The file is empty.', dataset: null })
  })
})

describe('bringing the data back after a refresh (H5)', () => {
  it('shows the app after the time limit, keeps the record and says the data could not be reached', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    fetchMock.mockImplementation(() => new Promise<Response>(() => {})) // a server that never answers
    await mount()
    expect(api.restoring).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS + 10) })
    expect(api.restoring).toBe(false)
    expect(api.state.notice).toContain('Howell.csv')
    expect(api.state.notice).toMatch(/connection/)
    expect(loadSession()).toMatchObject({ sessionId: 'old', filename: 'Howell.csv' })
  })

  it('keeps the record when the network is down, so the next refresh can try again', async () => {
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await mount()
    await settle()
    expect(api.state.status).toBe('idle')
    expect(api.state.notice).toMatch(/connection/)
    expect(loadSession()).toMatchObject({ filename: 'Howell.csv' })
  })

  it('keeps the record on a server error, but forgets it when the example is really gone (404)', async () => {
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    await mount()
    await settle()
    expect(loadSession()).not.toBeNull()
    act(() => root.unmount())
    root = createRoot(container)
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))
    await mount()
    await settle()
    expect(loadSession()).toBeNull()
    expect(api.state.notice).toMatch(/not stored in this browser any more/)
  })

  it('does not overwrite a file the reader loaded while the old one was coming back', async () => {
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    let finishExample!: (r: Response) => void
    fetchMock.mockImplementation((path: string) => path.startsWith('/datasets/')
      ? new Promise<Response>((resolve) => { finishExample = resolve })
      : Promise.resolve(session('sb')))
    await mount()
    await act(async () => { await api.loadFile(new File([B], 'b.csv')) })
    await act(async () => { finishExample(new Response(A)); await settle() })
    expect(api.state).toMatchObject({ filename: 'b.csv', sessionId: 'sb' })
    expect(api.restoring).toBe(false)
  })

  it('renders the children while the data is coming back', async () => {
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    await mount()
    expect(container.textContent).toBe('app')
    expect(api.restoring).toBe(true)
  })
})

describe('Clear data and saved page inputs (S10)', () => {
  it('forgets the pages’ saved inputs for the dataset but keeps Probability’s', async () => {
    await store.put(A)
    saveSession({ sessionId: 'old', filename: 'a.csv', exampleKey: null })
    savePageState('graphical', 'a.csv', { column: 'a1' })
    savePageState('probability', '*', { distName: 'Normal' })
    localStorage.setItem(COLUMN_TYPES_KEY, '{}')
    await mount()
    await settle()
    await act(async () => api.clearData())
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(localStorage.getItem(COLUMN_TYPES_KEY)).toBeNull()
    const kept = JSON.parse(localStorage.getItem(PAGE_STATE_KEY) ?? 'null') as { topics: Record<string, unknown> }
    expect(kept.topics).toEqual({ probability: { distName: 'Normal' } })
    expect(await store.get()).toBeNull()
  })
})
