// lib/sessionStore.ts
// What the browser keeps so a refresh, or a server restart, does not lose the dataset (REBUILD-HANDOFF,
// "Keeping the session"):
// - the session record (id, file name, which example, column types, filters) in localStorage;
// - the CSV text itself in IndexedDB, only for an uploaded file. An example is fetched again from /datasets.
// Every read and write is wrapped: private windows and blocked storage simply mean nothing is kept.

import { forgetDatasetPageState, PAGE_STATE_KEY } from './pageState'

export interface SavedSession {
  sessionId: string
  filename: string
  /** The example's file name in public/datasets, or null for an uploaded file. */
  exampleKey: string | null
  numericCols?: string[]
  categoricalCols?: string[]
  filters?: Record<string, string[]>
}

export const SESSION_KEY = 'thotsakan-session'

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SavedSession>
    if (typeof value.sessionId !== 'string' || typeof value.filename !== 'string') return null
    return { exampleKey: null, ...value } as SavedSession
  } catch {
    return null
  }
}

export function saveSession(value: SavedSession): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)) } catch { /* nothing kept */ }
}

export function forgetSession(): void {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* nothing kept */ }
}

/** Where the uploaded CSV is kept. Tests swap in the in-memory one. */
export interface CsvStore {
  get(): Promise<string | null>
  put(text: string): Promise<void>
  clear(): Promise<void>
}

export function memoryCsvStore(): CsvStore {
  let text: string | null = null
  return {
    get: async () => text,
    put: async (next) => { text = next },
    clear: async () => { text = null },
  }
}

const DB_NAME = 'thotsakan'
const STORE = 'files'
const KEY = 'current-upload'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    // Another tab holds an older connection open: without this the promise would wait for it forever.
    request.onblocked = () => reject(new Error('The browser store is busy'))
  })
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  return openDb().then((db) => new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request ? (request.result as T) ?? null : null) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    // A quota failure aborts the transaction and fires only this.
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('The browser store aborted')) }
  }))
}

export function indexedDbCsvStore(): CsvStore {
  return {
    get: () => withStore<string>('readonly', (store) => store.get(KEY)).catch(() => null),
    put: (text) => withStore('readwrite', (store) => store.put(text, KEY)).then(() => undefined).catch(() => undefined),
    clear: () => withStore('readwrite', (store) => store.delete(KEY)).then(() => undefined).catch(() => undefined),
  }
}

let csvStore: CsvStore = typeof indexedDB === 'undefined' ? memoryCsvStore() : indexedDbCsvStore()

export function getCsvStore(): CsvStore {
  return csvStore
}

/** The column types the reader chose, kept beside the session record (written by DataContext). */
export const COLUMN_TYPES_KEY = 'thotsakan-column-types'

/** Fired on window by clearSavedData. */
export const SAVED_DATA_CLEARED = 'thotsakan:saved-data-cleared'

/**
 * Forget everything this browser kept about the data: the session record, the column types, every page's saved
 * inputs and the uploaded CSV. Sign-out calls it, so the next person on a shared PC finds nothing of the last.
 */
export function clearSavedData(): void {
  forgetSession()
  try {
    localStorage.removeItem(COLUMN_TYPES_KEY)
    localStorage.removeItem(PAGE_STATE_KEY)
  } catch { /* nothing kept */ }
  void csvStore.clear()
  // DataProvider listens, so the data in memory goes too.
  try { window.dispatchEvent(new Event(SAVED_DATA_CLEARED)) } catch { /* no window */ }
}

/** "Clear data": as clearSavedData, but Probability's inputs belong to no dataset and stay. */
export function clearDatasetData(): void {
  forgetSession()
  try { localStorage.removeItem(COLUMN_TYPES_KEY) } catch { /* nothing kept */ }
  forgetDatasetPageState()
  void csvStore.clear()
}

/** For tests. */
export function setCsvStore(next: CsvStore): void {
  csvStore = next
}
