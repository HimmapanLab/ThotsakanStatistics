import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider, useData } from './DataContext'
import { postJson, resetSessionAliases } from '../api/client'
import { loadSession, memoryCsvStore, saveSession, setCsvStore, type CsvStore } from '../lib/sessionStore'

vi.mock('../utils/parseFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/parseFile')>()
  // PapaParse's worker is not available in jsdom; parse the small test CSVs directly.
  return {
    ...real,
    parseFile: async (file: File) => {
      const [header, ...lines] = (await file.text()).trim().split('\n')
      const headers = header.split(',')
      const rows = lines.map((line) => Object.fromEntries(line.split(',').map((cell, i) => [headers[i], cell])))
      const numericCols = headers.filter((h) => rows.every((r) => Number.isFinite(Number(r[h]))))
      return { headers, rows, numericCols, categoricalCols: headers.filter((h) => !numericCols.includes(h)) }
    },
  }
})

const CSV = 'height,sex\n150,F\n160,M\n'
let root: Root
let container: HTMLDivElement
let api: ReturnType<typeof useData>
let store: CsvStore
let fetchMock: ReturnType<typeof vi.fn>
function Probe() { api = useData(); return <p data-testid="app">app</p> }
const mount = async () => { await act(async () => root.render(<DataProvider><Probe /></DataProvider>)) }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

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
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

describe('keeping the dataset across a refresh', () => {
  it('saves an uploaded file and its session after loading', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'up-1' })))
    await mount()
    await act(async () => api.loadFile(new File([CSV], 'mine.csv')))
    expect(loadSession()).toMatchObject({ sessionId: 'up-1', filename: 'mine.csv', exampleKey: null })
    expect(await store.get()).toBe(CSV)
  })

  it('brings back an upload from the browser copy, with its column types and filter, before the app mounts', async () => {
    await store.put(CSV)
    saveSession({ sessionId: 'old', filename: 'mine.csv', exampleKey: null, numericCols: ['height'], categoricalCols: ['sex'], filters: { sex: ['F'] } })
    await mount()
    await settle()
    expect(container.textContent).toBe('app')
    expect(api.state).toMatchObject({ status: 'ready', sessionId: 'old', filename: 'mine.csv', filters: { sex: ['F'] } })
    expect(api.filteredRows).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches an example again instead of keeping a copy', async () => {
    saveSession({ sessionId: 'ex', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    fetchMock.mockResolvedValueOnce(new Response(CSV))
    await mount()
    await settle()
    expect(fetchMock.mock.calls[0][0]).toBe('/datasets/Howell.csv')
    expect(api.state.sessionId).toBe('ex')
  })

  it('re-uploads silently when the server forgot the session, and keeps the id React sees', async () => {
    await store.put(CSV)
    saveSession({ sessionId: 'old', filename: 'mine.csv', exampleKey: null })
    await mount()
    await settle()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Session expired or not found. Please upload the dataset again.' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 'new' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    await expect(postJson('/api/graphical/compute', {}, { sessionId: 'old' })).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/data/upload')
    expect(((fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>)['x-session-id']).toBe('new')
    expect(api.state.sessionId).toBe('old')
    expect(loadSession()?.sessionId).toBe('new')
  })

  it('explains in one line when the data from last time is gone', async () => {
    saveSession({ sessionId: 'old', filename: 'mine.csv', exampleKey: null })
    await mount()
    await settle()
    expect(api.state.status).toBe('idle')
    expect(api.state.notice).toContain('mine.csv')
    expect(loadSession()).toBeNull()
  })

  it('forgets everything when the data is removed', async () => {
    await store.put(CSV)
    saveSession({ sessionId: 'old', filename: 'mine.csv', exampleKey: null })
    await mount()
    await settle()
    await act(async () => api.clearData())
    expect(loadSession()).toBeNull()
    expect(await store.get()).toBeNull()
  })
})
