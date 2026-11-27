import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_STATE_KEY, savePageState } from './pageState'
import {
  COLUMN_TYPES_KEY, SAVED_DATA_CLEARED, SESSION_KEY, clearDatasetData, clearSavedData, indexedDbCsvStore, loadSession,
  memoryCsvStore, saveSession, setCsvStore, type CsvStore,
} from './sessionStore'

let store: CsvStore
beforeEach(async () => {
  store = memoryCsvStore()
  setCsvStore(store)
  await store.put('a,b\n1,2\n')
  saveSession({ sessionId: 's1', filename: 'mine.csv', exampleKey: null })
  localStorage.setItem(COLUMN_TYPES_KEY, JSON.stringify({ filename: 'mine.csv', types: {} }))
  savePageState('graphical', 'mine.csv', { column: 'a' })
  savePageState('probability', '*', { distName: 'Normal' })
})
afterEach(() => vi.unstubAllGlobals())

describe('forgetting the saved data', () => {
  it('clearSavedData removes the session, the column types, every page’s inputs and the CSV, and says so', async () => {
    const heard = vi.fn()
    window.addEventListener(SAVED_DATA_CLEARED, heard)
    clearSavedData()
    window.removeEventListener(SAVED_DATA_CLEARED, heard)
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(localStorage.getItem(COLUMN_TYPES_KEY)).toBeNull()
    expect(localStorage.getItem(PAGE_STATE_KEY)).toBeNull()
    expect(await store.get()).toBeNull()
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('clearDatasetData keeps what belongs to no dataset (Probability)', async () => {
    clearDatasetData()
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(COLUMN_TYPES_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(PAGE_STATE_KEY) ?? 'null')).toEqual({ dataset: '', topics: { probability: { distName: 'Normal' } } })
    expect(await store.get()).toBeNull()
  })
})

describe('the IndexedDB store always settles (H5)', () => {
  it('gives up when another tab blocks the database', async () => {
    const request = {} as IDBOpenDBRequest
    vi.stubGlobal('indexedDB', { open: () => { setTimeout(() => request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent), 0); return request } })
    await expect(indexedDbCsvStore().get()).resolves.toBeNull()
    await expect(indexedDbCsvStore().put('x')).resolves.toBeUndefined()
  })

  it('gives up when a write is aborted, for example by the storage quota', async () => {
    const transaction = {} as IDBTransaction
    const db = {
      close: vi.fn(),
      transaction: () => {
        setTimeout(() => transaction.onabort?.(new Event('abort')), 0)
        return Object.assign(transaction, { objectStore: () => ({ put: () => ({}) }) })
      },
    }
    const request = {} as IDBOpenDBRequest
    Object.defineProperty(request, 'result', { value: db })
    vi.stubGlobal('indexedDB', { open: () => { setTimeout(() => request.onsuccess?.(new Event('success')), 0); return request } })
    await expect(indexedDbCsvStore().put('x')).resolves.toBeUndefined()
    expect(db.close).toHaveBeenCalled()
  })
})
