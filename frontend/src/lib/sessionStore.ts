// lib/sessionStore.ts
// What the browser keeps so a refresh, or a server restart, does not lose the dataset (REBUILD-HANDOFF,
// "Keeping the session"):
// - the session record (id, file name, which example, column types, filters) in localStorage;
// - the CSV text itself in IndexedDB, only for an uploaded file. An example is fetched again from /datasets.
// Every read and write is wrapped: private windows and blocked storage simply mean nothing is kept.

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
  })
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  return openDb().then((db) => new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request ? (request.result as T) ?? null : null) }
    tx.onerror = () => { db.close(); reject(tx.error) }
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

/** For tests. */
export function setCsvStore(next: CsvStore): void {
  csvStore = next
}
