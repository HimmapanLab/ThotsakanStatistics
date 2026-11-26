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
import { forgetSession, getCsvStore, loadSession, saveSession, type SavedSession } from '../lib/sessionStore'
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

/** The column types the reader chose, kept beside the session record (lib/sessionStore.ts holds only the two lists). */
export const COLUMN_TYPES_KEY = 'thotsakan-column-types'

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

function forgetColumnTypes(): void {
  try { localStorage.removeItem(COLUMN_TYPES_KEY) } catch { /* nothing kept */ }
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
      return { ...state, status: 'loading', errorMsg: '' }

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
        notice: '',
      }
    }

    case 'NOTICE':
      return { ...state, notice: action.payload }

    case 'ERROR':
      return { ...state, status: 'error', errorMsg: action.payload }

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

  /** True while the data from last time is being brought back after a refresh. */
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

  const loadFile = useCallback(async (file: File, options?: { exampleKey?: string | null }): Promise<boolean> => {
    dispatch({ type: 'LOADING' })
    try {
      const [dataset, text, sessionId] = await Promise.all([parseFile(file), file.text(), uploadCsv(file)])
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
      dispatch({ type: 'ERROR', payload: e instanceof Error ? e.message : String(e) })
      return false
    }
  }, [])

  // Bring back the data from last time: the example from /datasets, an upload from IndexedDB. The saved session
  // id is used as is; if the server has forgotten it, the first request renews it (api/client.ts).
  useEffect(() => {
    const saved = loadSession()
    if (!saved) return
    let cancelled = false
    void (async () => {
      try {
        let text: string | null = null
        if (saved.exampleKey) {
          const response = await fetch(`${import.meta.env.BASE_URL}datasets/${saved.exampleKey}`)
          if (response.ok) text = await response.text()
        } else {
          text = await getCsvStore().get()
        }
        if (cancelled) return
        if (!text) throw new Error('missing')
        const dataset = await parseFile(new File([text], saved.filename, { type: 'text/csv' }))
        if (cancelled) return
        source.current = { text, filename: saved.filename, exampleKey: saved.exampleKey }
        dispatch({ type: 'LOADED', payload: { dataset, filename: saved.filename, sessionId: saved.sessionId, restored: { ...saved, columnTypes: savedColumnTypes(saved.filename) } } })
      } catch {
        if (cancelled) return
        forgetSession()
        dispatch({ type: 'NOTICE', payload: `${saved.filename} from your last visit is not stored in this browser any more. Load it again to continue.` })
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
    source.current = null
    resetSessionAliases()
    forgetSession()
    forgetColumnTypes()
    void getCsvStore().clear()
    dispatch({ type: 'CLEAR' })
  }, [])

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
      {restoring
        ? <p role="status" className="p-6 text-sm text-[var(--color-text-muted)]">Bringing back your data…</p>
        : children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
