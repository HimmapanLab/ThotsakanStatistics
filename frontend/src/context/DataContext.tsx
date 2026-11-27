// context/DataContext.tsx
// Global data store using React Context + useReducer

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { parseFile, extractNumeric, uniqueValues, type ParsedDataset } from '../utils/parseFile'
import {
  guessTypes, isCategoryType, MAX_LEVELS, profileColumns, splitColumns, typeFit, typesFromLists, validTypes,
  type ColumnProfile, type ColumnType, type ColumnTypes,
} from '../utils/columnTypes'
import { liveSessionId, resetSessionAliases, setSessionRenewer, uploadCsv } from '../api/client'
import {
  clearDatasetData, COLUMN_TYPES_KEY, forgetSession, getCsvStore, loadSession, saveSession, SAVED_DATA_CLEARED,
  type SavedSession,
} from '../lib/sessionStore'
import { clampPrecision, PRECISION_DEFAULT } from '../utils/formatNumber'

/** The display precision is a preference of this browser, kept across reloads and datasets. */
export const PRECISION_KEY = 'thotsakan-display-precision'

function savedPrecision(): number {
  try {
    const raw = localStorage.getItem(PRECISION_KEY)
    return raw === null ? PRECISION_DEFAULT : clampPrecision(raw)
  } catch {
    return PRECISION_DEFAULT
  }
}

function saveColumnTypes(filename: string, types: ColumnTypes): void {
  try { localStorage.setItem(COLUMN_TYPES_KEY, JSON.stringify({ filename, types })) } catch { /* nothing kept */ }
}

function savedColumnTypes(filename: string): Partial<ColumnTypes> | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(COLUMN_TYPES_KEY) ?? 'null') as { filename?: unknown; types?: unknown } | null
    if (!value || value.filename !== filename || typeof value.types !== 'object' || value.types === null) return undefined
    return value.types as Partial<ColumnTypes>
  } catch {
    return undefined
  }
}

// ─── Bringing the data back ───────────────────────────────────────────────────

/** How long a refresh waits for the server and the browser store before it shows the app without the data. */
export const RESTORE_TIMEOUT_MS = 8000

/** The saved data could not be read right now (no network, a slow store). It may still be there next time. */
class RestoreUnavailable extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RestoreUnavailable('timeout')), ms)
    work.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

/** The CSV text from last time, or null when it is really gone (no copy in the store, the example is a 404). */
async function readSavedCsv(saved: SavedSession): Promise<string | null> {
  if (!saved.exampleKey) return getCsvStore().get()
  let response: Response
  try {
    response = await fetch(`${import.meta.env.BASE_URL}datasets/${saved.exampleKey}`)
  } catch {
    throw new RestoreUnavailable('network')
  }
  if (response.status === 404) return null
  if (!response.ok) throw new RestoreUnavailable(`status ${response.status}`)
  return response.text()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataState {
  // Raw parsed dataset
  dataset: ParsedDataset | null
  filename: string
  sessionId: string | null

  // Active filters: { colName: selectedValues[] }
  filters: Record<string, string[]>

  // The type of every column (Continuous, Discrete, Ordinal, Nominal or ID), guessed first, then the reader's choice
  columnTypes: ColumnTypes
  // What the types are guessed and checked against
  profiles: Record<string, ColumnProfile>
  // Earlier and undone type choices, so a type change can be taken back
  typeUndo: ColumnTypes[]
  typeRedo: ColumnTypes[]

  // Derived from columnTypes, in header order: Continuous + Discrete, and Ordinal + Nominal. ID is in neither.
  numericCols: string[]
  categoricalCols: string[]

  // Display settings
  displayPrecision: number

  // Status
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMsg: string
  /** Why the last load failed while earlier data is still loaded and usable (with no data, `status` is 'error'). */
  loadError: string
  /** One line for the Data tab, e.g. why the data from last time could not be brought back. */
  notice: string
}

const initialState: DataState = {
  dataset: null,
  filename: '',
  sessionId: null,
  filters: {},
  columnTypes: {},
  profiles: {},
  typeUndo: [],
  typeRedo: [],
  numericCols: [],
  categoricalCols: [],
  displayPrecision: PRECISION_DEFAULT,
  status: 'idle',
  errorMsg: '',
  loadError: '',
  notice: '',
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOADING' }
  | { type: 'LOADED'; payload: { dataset: ParsedDataset; filename: string; sessionId: string; restored?: Pick<SavedSession, 'numericCols' | 'categoricalCols' | 'filters'> & { columnTypes?: Partial<ColumnTypes> } } }
  | { type: 'NOTICE'; payload: string }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR' }
  | { type: 'SET_FILTER'; payload: { col: string; values: string[] } }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_TYPE'; payload: { col: string; type: ColumnType } }
  | { type: 'UNDO_TYPES' }
  | { type: 'REDO_TYPES' }
  | { type: 'SET_PRECISION'; payload: number }

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', errorMsg: '', loadError: '' }

    case 'LOADED': {
      const { dataset, filename, sessionId, restored } = action.payload
      const profiles = dataset.profiles ?? profileColumns(dataset.headers, dataset.rows)
      // After a refresh, keep the column types the reader had; older sessions saved only the two lists.
      const columnTypes = restored?.columnTypes
        ? validTypes(dataset.headers, profiles, restored.columnTypes)
        : restored?.numericCols && restored.categoricalCols
          ? typesFromLists(dataset.headers, profiles, restored.numericCols, restored.categoricalCols)
          : guessTypes(profiles)
      // ...and the filters, for columns that still exist and can still be filtered.
      const filters = pruneFilters(Object.fromEntries(Object.entries(restored?.filters ?? {})
        .filter(([col, values]) => dataset.headers.includes(col) && Array.isArray(values) && values.length > 0)), columnTypes)
      return {
        ...state,
        dataset,
        filename,
        sessionId,
        profiles,
        columnTypes,
        typeUndo: [],
        typeRedo: [],
        ...splitColumns(dataset.headers, columnTypes),
        filters,
        status: 'ready',
        errorMsg: '',
        loadError: '',
        notice: '',
      }
    }

    case 'NOTICE':
      return { ...state, notice: action.payload }

    case 'ERROR':
      // A failed load must not take the data the reader already has: it stays usable, the error is shown beside it.
      return state.dataset
        ? { ...state, status: 'ready', errorMsg: '', loadError: action.payload }
        : { ...state, status: 'error', errorMsg: action.payload }

    case 'CLEAR':
      // Removing the data keeps the reader's display preference.
      return { ...initialState, displayPrecision: state.displayPrecision }

    case 'SET_FILTER': {
      const { col, values } = action.payload
      const newFilters = { ...state.filters }
      if (values.length === 0) delete newFilters[col]
      else newFilters[col] = values
      return { ...state, filters: newFilters }
    }

    case 'CLEAR_FILTERS':
      return { ...state, filters: {} }

    case 'SET_TYPE': {
      const { col, type } = action.payload
      const profile = state.profiles[col]
      if (!state.dataset || !profile || state.columnTypes[col] === type || !typeFit(profile, type).ok) return state
      return withTypes({ ...state, typeUndo: [...state.typeUndo, state.columnTypes], typeRedo: [] }, { ...state.columnTypes, [col]: type })
    }

    case 'UNDO_TYPES': {
      const previous = state.typeUndo[state.typeUndo.length - 1]
      if (!previous) return state
      return withTypes({ ...state, typeUndo: state.typeUndo.slice(0, -1), typeRedo: [...state.typeRedo, state.columnTypes] }, previous)
    }

    case 'REDO_TYPES': {
      const next = state.typeRedo[state.typeRedo.length - 1]
      if (!next) return state
      return withTypes({ ...state, typeRedo: state.typeRedo.slice(0, -1), typeUndo: [...state.typeUndo, state.columnTypes] }, next)
    }

    case 'SET_PRECISION':
      return { ...state, displayPrecision: action.payload }

    default:
      return state
  }
}

/** A filter needs a category column: when a column stops being Nominal or Ordinal its filter goes with it. */
function pruneFilters(filters: Record<string, string[]>, types: ColumnTypes): Record<string, string[]> {
  return Object.fromEntries(Object.entries(filters).filter(([col]) => isCategoryType(types[col])))
}

/** New column types, with the two lists and the filters kept in step. */
function withTypes(state: DataState, columnTypes: ColumnTypes): DataState {
  return {
    ...state,
    columnTypes,
    ...splitColumns(state.dataset?.headers ?? [], columnTypes),
    filters: pruneFilters(state.filters, columnTypes),
  }
}

// ─── Computed helpers ─────────────────────────────────────────────────────────

/** Apply active filters to the dataset rows */
function applyFilters(
  rows: Record<string, string>[],
  filters: Record<string, string[]>
): Record<string, string>[] {
  const entries = Object.entries(filters).filter(([, vals]) => vals.length > 0)
  if (entries.length === 0) return rows
  return rows.filter((row) =>
    entries.every(([col, vals]) => vals.includes(row[col] ?? ''))
  )
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface DataContextValue {
  state: DataState

  // Derived
  filteredRows: Record<string, string>[]
  getNumericData: (col: string) => number[]
  getUniqueValues: (col: string) => string[]

  /** True while the data from last time is being brought back after a refresh (App shows a shell until then). */
  restoring: boolean

  // Actions
  /** Load a CSV. `exampleKey` is the file name of a bundled example, so it can be fetched again later.
   *  Resolves true when the data is loaded, false when it was not (the error is in `state.errorMsg`). */
  loadFile: (file: File, options?: { exampleKey?: string | null }) => Promise<boolean>
  clearData: () => void
  setFilter: (col: string, values: string[]) => void
  clearFilters: () => void
  /** Older two-way switch, kept for callers that only know numeric or categorical. Prefer setColumnType. */
  reclassify: (col: string, to: 'numeric' | 'categorical') => void
  /** Give a column a type. Refused (false) when the values do not fit it: see typeFit in utils/columnTypes. */
  setColumnType: (col: string, type: ColumnType) => boolean
  undoColumnTypes: () => void
  redoColumnTypes: () => void
  setPrecision: (p: number) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => ({ ...init, displayPrecision: savedPrecision() }))

  // Memoized: a new array on every render made every consumer recompute, and froze the page on large files.
  const filteredRows = useMemo(() => state.dataset
    ? applyFilters(state.dataset.rows, state.filters)
    : [], [state.dataset, state.filters])

  // One sorted list of categories per column and dataset, computed the first time it is asked for.
  const uniqueCache = useMemo(() => new Map<string, string[]>(), [state.dataset])

  const [restoring, setRestoring] = useState(() => loadSession() !== null)
  // The CSV text and example of the loaded data, so an expired session can be renewed by uploading it again.
  const source = useRef<{ text: string; filename: string; exampleKey: string | null } | null>(null)

  // Only the most recent load may land: each call takes a number, and a call that is no longer the latest (or that
  // came before Clear data) is dropped when it finishes. `loadAbort` also cancels its upload.
  const loadToken = useRef(0)
  const loadAbort = useRef<AbortController | null>(null)
  const supersedeLoads = useCallback(() => {
    loadAbort.current?.abort()
    loadAbort.current = null
    return ++loadToken.current
  }, [])

  const loadFile = useCallback(async (file: File, options?: { exampleKey?: string | null }): Promise<boolean> => {
    const token = supersedeLoads()
    const controller = new AbortController()
    loadAbort.current = controller
    dispatch({ type: 'LOADING' })
    try {
      // Read the file first: its own error (empty, not UTF-8) is clearer than the server's, and nothing is uploaded
      // for a file that cannot be read.
      const dataset = await parseFile(file)
      if (token !== loadToken.current) return false
      const [text, sessionId] = await Promise.all([file.text(), uploadCsv(file, controller.signal)])
      if (token !== loadToken.current) return false
      const exampleKey = options?.exampleKey ?? null
      resetSessionAliases()
      source.current = { text, filename: file.name, exampleKey }
      saveSession({ sessionId, filename: file.name, exampleKey })
      // Only an uploaded file needs a copy in the browser; an example is fetched again.
      if (exampleKey) void getCsvStore().clear()
      else void getCsvStore().put(text)
      dispatch({ type: 'LOADED', payload: { dataset, filename: file.name, sessionId } })
      return true
    } catch (e) {
      if (token !== loadToken.current) return false
      dispatch({ type: 'ERROR', payload: e instanceof Error ? e.message : String(e) })
      return false
    }
  }, [supersedeLoads])

  // Bring back the data from last time: the example from /datasets, an upload from IndexedDB. The saved session
  // id is used as is; if the server has forgotten it, the first request renews it (api/client.ts).
  // The saved record is forgotten only when the CSV is really gone. A slow or unreachable server or browser store
  // keeps it, so the next refresh can try again.
  useEffect(() => {
    const saved = loadSession()
    if (!saved) return
    let cancelled = false
    const token = loadToken.current
    // Unmounted, or the reader loaded or cleared data in the meantime.
    const abandoned = () => cancelled || token !== loadToken.current
    void (async () => {
      try {
        const text = await withTimeout(readSavedCsv(saved), RESTORE_TIMEOUT_MS)
        if (abandoned()) return
        if (!text) throw new Error('missing')
        const dataset = await parseFile(new File([text], saved.filename, { type: 'text/csv' }))
        if (abandoned()) return
        source.current = { text, filename: saved.filename, exampleKey: saved.exampleKey }
        dispatch({ type: 'LOADED', payload: { dataset, filename: saved.filename, sessionId: saved.sessionId, restored: { ...saved, columnTypes: savedColumnTypes(saved.filename) } } })
      } catch (error) {
        if (abandoned()) return
        if (error instanceof RestoreUnavailable) {
          dispatch({ type: 'NOTICE', payload: `Couldn’t bring back ${saved.filename} from your last visit. Check your connection and refresh to try again.` })
        } else {
          forgetSession()
          dispatch({ type: 'NOTICE', payload: `${saved.filename} from your last visit is not stored in this browser any more. Load it again to continue.` })
        }
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Renew an expired session by uploading the same CSV again.
  useEffect(() => {
    setSessionRenewer(async () => {
      const current = source.current
      if (!current) return null
      const fresh = await uploadCsv(new File([current.text], current.filename, { type: 'text/csv' }))
      // Another file was loaded, or the data was cleared, while this upload was on its way: the new session
      // belongs to data that is no longer there, so it is dropped and never saved.
      if (source.current !== current) return null
      const saved = loadSession()
      saveSession({ ...(saved ?? { filename: current.filename, exampleKey: current.exampleKey }), sessionId: fresh })
      return fresh
    })
    return () => setSessionRenewer(null)
  }, [])

  // Keep the saved record in step with column types and filters.
  useEffect(() => {
    if (state.status !== 'ready' || !state.sessionId || !source.current) return
    saveSession({
      sessionId: liveSessionId(state.sessionId),
      filename: state.filename,
      exampleKey: source.current.exampleKey,
      numericCols: state.numericCols,
      categoricalCols: state.categoricalCols,
      filters: state.filters,
    })
    saveColumnTypes(state.filename, state.columnTypes)
  }, [state.status, state.sessionId, state.filename, state.numericCols, state.categoricalCols, state.filters, state.columnTypes])

  const clearData = useCallback(() => {
    supersedeLoads()
    source.current = null
    resetSessionAliases()
    clearDatasetData()
    dispatch({ type: 'CLEAR' })
  }, [supersedeLoads])

  // Sign-out (or another person signing in) forgets the saved data: drop what is in memory too.
  useEffect(() => {
    const onCleared = () => {
      supersedeLoads()
      source.current = null
      resetSessionAliases()
      dispatch({ type: 'CLEAR' })
    }
    window.addEventListener(SAVED_DATA_CLEARED, onCleared)
    return () => window.removeEventListener(SAVED_DATA_CLEARED, onCleared)
  }, [supersedeLoads])

  const setFilter = useCallback((col: string, values: string[]) =>
    dispatch({ type: 'SET_FILTER', payload: { col, values } }), [])

  const clearFilters = useCallback(() => dispatch({ type: 'CLEAR_FILTERS' }), [])

  const typesRef = useRef(state)
  typesRef.current = state

  const setColumnType = useCallback((col: string, type: ColumnType): boolean => {
    const profile = typesRef.current.profiles[col]
    if (!profile || !typeFit(profile, type).ok) return false
    dispatch({ type: 'SET_TYPE', payload: { col, type } })
    return true
  }, [])

  const reclassify = useCallback((col: string, to: 'numeric' | 'categorical') => {
    const profile = typesRef.current.profiles[col]
    if (!profile) return
    const type: ColumnType = to === 'categorical' ? 'Nominal' : profile.wholeNumbers && profile.nUnique <= MAX_LEVELS ? 'Discrete' : 'Continuous'
    setColumnType(col, type)
  }, [setColumnType])

  const undoColumnTypes = useCallback(() => dispatch({ type: 'UNDO_TYPES' }), [])
  const redoColumnTypes = useCallback(() => dispatch({ type: 'REDO_TYPES' }), [])

  const setPrecision = useCallback((p: number) => {
    const precision = clampPrecision(p)
    try { localStorage.setItem(PRECISION_KEY, String(precision)) } catch { /* private mode: keep it for this visit */ }
    dispatch({ type: 'SET_PRECISION', payload: precision })
  }, [])

  const getNumericData = useCallback((col: string) =>
    state.dataset ? extractNumeric(filteredRows, col) : [], [state.dataset, filteredRows])

  const getUniqueValues = useCallback((col: string) => {
    if (!state.dataset) return []
    let levels = uniqueCache.get(col)
    if (!levels) {
      levels = uniqueValues(state.dataset.rows, col)
      uniqueCache.set(col, levels)
    }
    return levels
  }, [state.dataset, uniqueCache])

  return (
    <DataContext.Provider value={{
      state,
      filteredRows,
      getNumericData,
      getUniqueValues,
      restoring,
      loadFile,
      clearData,
      setFilter,
      clearFilters,
      reclassify,
      setColumnType,
      undoColumnTypes,
      redoColumnTypes,
      setPrecision,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
