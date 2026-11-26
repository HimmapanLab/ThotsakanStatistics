// What the results say before there is anything to analyse. Prototype: emptyState, noNumericState.
import { useDrawer } from '../context/DrawerContext'
import { EXAMPLE_DATASETS, useLoadExample } from '../features/data/ExampleDatasets'

const ELECTRICITY = EXAMPLE_DATASETS.find((dataset) => dataset.file === 'ElectricityDemand.csv')!

/** No dataset is loaded: say so, and offer the two ways out. Probability works without data. */
export function NoDataState() {
  const { setOpen } = useDrawer()
  const { load, error } = useLoadExample()

  return (
    <div className="bench-empty" data-state="no-data">
      <h2>No data loaded yet</h2>
      <p>Pick an example dataset or upload a CSV. Probability works without data.</p>
      <div className="bench-empty-actions">
        <button type="button" className="sh-btn" onClick={() => setOpen(true)}>Open Data</button>
        <button type="button" className="sh-btn sh-btn-primary" onClick={() => { void load(ELECTRICITY) }}>Use Electricity demand</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  )
}

/** Data is loaded, but no column can be analysed as a number. */
export function NoNumericState() {
  const { setOpen } = useDrawer()
  return (
    <div className="bench-empty" data-state="no-numeric">
      <h2>No Continuous or Discrete column</h2>
      <p>Every column is typed as a category or an ID. Open Data and change a column’s type to analyse it.</p>
      <div className="bench-empty-actions">
        <button type="button" className="sh-btn" onClick={() => setOpen(true)}>Open Data</button>
      </div>
    </div>
  )
}

/** Data is on its way (a file is being read or uploaded). */
export function LoadingDataState() {
  return <p role="status" className="bench-empty-status">Loading data…</p>
}
