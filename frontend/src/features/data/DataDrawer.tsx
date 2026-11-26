// features/data/DataDrawer.tsx
// The Data drawer: example datasets, CSV upload, the first rows with sort, the column types and a filter. It takes
// the place of the inputs panel while it is open (LabBench), unrolls from the rail over 240 ms, and holds the focus
// order: it opens with the Close button focused, Esc or Close shuts it and DataRail takes the focus back.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useDrawer } from '../../context/DrawerContext'
import { haptic } from '../../lib/haptics'
import { FilterChip } from '../../components/lab/FilterChip'
import { DataGrid } from './DataGrid'
import { datasetTitle, ExampleList } from './ExampleDatasets'
import { FilterMenu, useFilterColumns } from './FilterMenu'
import { CloseIcon, FilterIcon, RedoIcon, UndoIcon, UploadIcon } from './icons'
import './data.css'

export default function DataDrawer() {
  const { state, filteredRows, loadFile, clearData, clearFilters, undoColumnTypes, redoColumnTypes } = useData()
  const { setOpen } = useDrawer()
  const closeRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [examples, setExamples] = useState<boolean | null>(null) // null: open while there is no data
  const [upload, setUpload] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterColumns = useFilterColumns()

  const hasData = state.dataset != null
  const showExamples = examples ?? !hasData
  const filtered = Object.values(state.filters).some((values) => values.length > 0)

  // Opening the drawer moves the focus into it.
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }) }, [])

  const handleFile = useCallback(async (file: File) => {
    // A buzz confirms a load the reader asked for, after it has happened (lib/haptics ignores anything but touch).
    if (await loadFile(file)) haptic('confirm')
  }, [loadFile])

  const closeFilter = useCallback((returnFocus: boolean) => {
    setFilterOpen(false)
    if (returnFocus) filterRef.current?.focus({ preventScroll: true })
  }, [])

  const noFilterColumn = filterColumns.length === 0 && !filtered

  return (
    <section
      id="data-panel"
      className="data-drawer"
      aria-label="Data"
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false) } }}
    >
      <div className="data-head">
        <h2>Data</h2>
        <button ref={closeRef} type="button" className="lab-btn-quiet lab-btn-icon" aria-label="Close Data" onClick={() => setOpen(false)}>
          <CloseIcon />
        </button>
      </div>

      <div className="data-tools">
        <button type="button" className="lab-btn" aria-expanded={showExamples} onClick={() => setExamples(!showExamples)}>Example data</button>
        <button type="button" className="lab-btn" onClick={() => { setUpload(true); fileRef.current?.click() }}>
          <UploadIcon />Upload CSV
        </button>
        {hasData && (
          <button ref={filterRef} type="button" className="lab-btn" aria-haspopup="dialog" aria-expanded={filterOpen}
            disabled={noFilterColumn}
            title={noFilterColumn ? 'No Nominal or Ordinal column with a few levels to filter by' : undefined}
            onClick={() => setFilterOpen((value) => !value)}>
            <FilterIcon />Filter
          </button>
        )}
        {hasData && (
          <>
            <button type="button" className="lab-btn lab-btn-icon" aria-label="Undo type change" disabled={state.typeUndo.length === 0} onClick={undoColumnTypes}><UndoIcon /></button>
            <button type="button" className="lab-btn lab-btn-icon" aria-label="Redo type change" disabled={state.typeRedo.length === 0} onClick={redoColumnTypes}><RedoIcon /></button>
          </>
        )}
        {filtered && (
          <>
            <FilterChip />
            <button type="button" className="lab-btn-quiet" onClick={() => { clearFilters(); filterRef.current?.focus({ preventScroll: true }) }}>Clear filter</button>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleFile(file) }} />
      </div>

      {showExamples && (
        <div className="data-extra">
          <ExampleList current={hasData ? state.filename : undefined} onLoaded={() => haptic('confirm')}>
            <li>
              <button type="button" className="data-example" aria-pressed={!hasData} onClick={clearData}>
                <span className="data-example-name">Clear data</span>
                <span className="data-example-desc">Remove the loaded data. Probability still works.</span>
              </button>
            </li>
          </ExampleList>
        </div>
      )}

      {upload && (
        <div className="data-extra">
          <div
            className={`data-dropzone${dragging ? ' is-over' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files[0]
              if (file) void handleFile(file)
            }}
          >
            Drop a CSV here or{' '}
            <button type="button" className="lab-btn-quiet" onClick={() => fileRef.current?.click()}>choose a file</button>. CSV only.
          </div>
        </div>
      )}

      {state.status === 'loading' && <p className="data-note" role="status">Loading the data…</p>}
      {state.status === 'error' && <p className="data-note data-note-error" role="alert">{state.errorMsg}</p>}
      {state.notice && !hasData && <p className="data-note" role="status">{state.notice}</p>}

      {hasData ? (
        <DataGrid label={datasetTitle(state.filename)} />
      ) : (
        state.status !== 'loading' && (
          <div className="data-empty">
            <h3>No data loaded yet</h3>
            <p>Pick an example dataset or upload a CSV. Probability works without data.</p>
          </div>
        )
      )}

      {filterOpen && <FilterMenu anchorRef={filterRef} onClose={closeFilter} />}
      <span className="sr-only" role="status" aria-live="polite">
        {hasData && filtered ? `Filtered ${filteredRows.length.toLocaleString('en-US')} of ${state.dataset!.rows.length.toLocaleString('en-US')} rows` : ''}
      </span>
    </section>
  )
}
