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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataState {
  // Raw parsed dataset
  dataset: ParsedDataset | null
  filename: string
  sessionId: string | null

  // Active filters: { colName: selectedValues[] }
  filters: Record<string, string[]>

  // Manually overridden column types
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
  | { type: 'LOADED'; payload: { dataset: ParsedDataset; filename: string; sessionId: string; restored?: Pick<SavedSession, 'numericCols' | 'categoricalCols' | 'filters'> } }
  | { type: 'NOTICE'; payload: string }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR' }
  | { type: 'SET_FILTER'; payload: { col: string; values: string[] } }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'RECLASSIFY'; payload: { col: string; to: 'numeric' | 'categorical' } }
  | { type: 'SET_PRECISION'; payload: number }

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', errorMsg: '' }

    case 'LOADED': {
      const { dataset, filename, sessionId, restored } = action.payload
      // After a refresh, keep the column types and filters the user had, for columns that still exist.
      const known = (cols: string[] | undefined) => cols?.filter((col) => dataset.headers.includes(col))
      const filters = Object.fromEntries(Object.entries(restored?.filters ?? {})
        .filter(([col, values]) => dataset.headers.includes(col) && Array.isArray(values) && values.length > 0))
      const numeric = known(restored?.numericCols)
      const categorical = known(restored?.categoricalCols)
      const restoredTypes = !!numeric && !!categorical
      return {
        ...state,
        dataset,
        filename,
        sessionId,
        numericCols: restoredTypes ? numeric : dataset.numericCols,
        categoricalCols: restoredTypes ? categorical : dataset.categoricalCols,
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

    case 'RECLASSIFY': {
      const { col, to } = action.payload
      if (to === 'numeric') {
        return {
          ...state,
          numericCols: [...state.numericCols.filter((c) => c !== col), col],
          categoricalCols: state.categoricalCols.filter((c) => c !== col),
        }
      } else {
        return {
          ...state,
          categoricalCols: [...state.categoricalCols.filter((c) => c !== col), col],
          numericCols: state.numericCols.filter((c) => c !== col),
        }
      }
    }

    case 'SET_PRECISION':
      return { ...state, displayPrecision: action.payload }

    default:
      return state
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
  /** Load a CSV. `exampleKey` is the file name of a bundled example, so it can be fetched again later. */
  loadFile: (file: File, options?: { exampleKey?: string | null }) => Promise<void>
  clearData: () => void
  setFilter: (col: string, values: string[]) => void
  clearFilters: () => void
  reclassify: (col: string, to: 'numeric' | 'categorical') => void
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

  const loadFile = useCallback(async (file: File, options?: { exampleKey?: string | null }) => {
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
    } catch (e) {
      dispatch({ type: 'ERROR', payload: e instanceof Error ? e.message : String(e) })
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
        dispatch({ type: 'LOADED', payload: { dataset, filename: saved.filename, sessionId: saved.sessionId, restored: saved } })
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
  }, [state.status, state.sessionId, state.filename, state.numericCols, state.categoricalCols, state.filters])

  const clearData = useCallback(() => {
    source.current = null
    resetSessionAliases()
    forgetSession()
    void getCsvStore().clear()
    dispatch({ type: 'CLEAR' })
  }, [])

  const setFilter = useCallback((col: string, values: string[]) =>
    dispatch({ type: 'SET_FILTER', payload: { col, values } }), [])

  const clearFilters = useCallback(() => dispatch({ type: 'CLEAR_FILTERS' }), [])

  const reclassify = useCallback((col: string, to: 'numeric' | 'categorical') =>
    dispatch({ type: 'RECLASSIFY', payload: { col, to } }), [])

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
