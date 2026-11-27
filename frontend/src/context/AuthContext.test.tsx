import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, LAST_USER_KEY, useAuth } from './AuthContext'
import { DataProvider, useData } from './DataContext'
import { PAGE_STATE_KEY, savePageState } from '../lib/pageState'
import { COLUMN_TYPES_KEY, loadSession, memoryCsvStore, saveSession, setCsvStore, type CsvStore } from '../lib/sessionStore'

vi.mock('../utils/parseFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/parseFile')>()
  return {
    ...real,
    parseFile: async (file: File) => {
      const [header, ...lines] = (await file.text()).trim().split('\n')
      const headers = header.split(',')
      const rows = lines.map((line) => Object.fromEntries(line.split(',').map((cell, i) => [headers[i], cell])))
      return { headers, rows, numericCols: headers, categoricalCols: [] }
    },
  }
})

const CSV = 'height,weight\n150,47\n160,52\n'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let root: Root
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
let data: ReturnType<typeof useData>
let store: CsvStore
let me: { email: string; name: string; picture: string } | null
let fetchMock: ReturnType<typeof vi.fn>
const realFetch = window.fetch

function Probe() { auth = useAuth(); data = useData(); return null }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const mount = async () => {
  await act(async () => root.render(<AuthProvider><DataProvider><Probe /></DataProvider></AuthProvider>))
  await settle()
}
const keepSomeData = async () => {
  await store.put(CSV)
  saveSession({ sessionId: 's1', filename: 'mine.csv', exampleKey: null })
  localStorage.setItem(COLUMN_TYPES_KEY, '{}')
  savePageState('descriptive', 'mine.csv', { column: 'height' })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  store = memoryCsvStore()
  setCsvStore(store)
  me = { email: 'ada@example.org', name: 'Ada', picture: '' }
  fetchMock = vi.fn(async (path: string) => {
    if (path === '/api/auth/config') return json({ enabled: true, clientId: 'c', allowedDomain: 'example.org' })
    if (path === '/api/auth/me') return me ? json(me) : json({ detail: 'no' }, 401)
    return json({ ok: true })
  })
  window.fetch = fetchMock as unknown as typeof window.fetch
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.fetch = realFetch
})

describe('saved data and who signs in (H1)', () => {
  it('forgets the data, in the browser and in memory, when the reader signs out', async () => {
    await keepSomeData()
    await mount()
    expect(data.state.status).toBe('ready')
    expect(localStorage.getItem(LAST_USER_KEY)).toBe('ada@example.org')
    await act(async () => { await auth.signOut() })
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(COLUMN_TYPES_KEY)).toBeNull()
    expect(localStorage.getItem(PAGE_STATE_KEY)).toBeNull()
    expect(localStorage.getItem(LAST_USER_KEY)).toBeNull()
    expect(await store.get()).toBeNull()
    expect(data.state).toMatchObject({ status: 'idle', dataset: null })
  })

  it('keeps the data for the same person after a refresh', async () => {
    localStorage.setItem(LAST_USER_KEY, 'ada@example.org')
    await keepSomeData()
    await mount()
    expect(data.state).toMatchObject({ status: 'ready', filename: 'mine.csv' })
    expect(loadSession()).not.toBeNull()
  })

  it('forgets the last person’s data when someone else is signed in', async () => {
    localStorage.setItem(LAST_USER_KEY, 'bob@example.org')
    await keepSomeData()
    await mount()
    expect(loadSession()).toBeNull()
    expect(await store.get()).toBeNull()
    expect(data.state).toMatchObject({ status: 'idle', dataset: null })
    expect(localStorage.getItem(LAST_USER_KEY)).toBe('ada@example.org')
  })

  it('does the same when another person signs in after the session expired (no sign-out)', async () => {
    await mount()
    me = null
    await act(async () => { await auth.signOut() })
    localStorage.setItem(LAST_USER_KEY, 'bob@example.org')
    await keepSomeData()
    fetchMock.mockImplementation(async (path: string) => path === '/api/auth/google'
      ? json({ email: 'ada@example.org', name: 'Ada', picture: '' }) : json({ ok: true }))
    await act(async () => { await auth.signIn('credential') })
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(LAST_USER_KEY)).toBe('ada@example.org')
  })
})
