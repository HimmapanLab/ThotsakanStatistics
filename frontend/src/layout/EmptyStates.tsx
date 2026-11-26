// What the results say before there is anything to analyse. Prototype: emptyState, noNumericState.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useDrawer } from '../context/DrawerContext'

const EXAMPLE_FILE = 'ElectricityDemand.csv'

/** No dataset is loaded: say so, and offer the two ways out. Probability works without data. */
export function NoDataState() {
  const { loadFile } = useData()
  const { setOpen } = useDrawer()
  const [error, setError] = useState<string | null>(null)

  async function useExample() {
    setError(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}datasets/${EXAMPLE_FILE}`)
      if (!response.ok) throw new Error(`status ${response.status}`)
      await loadFile(new File([await response.text()], EXAMPLE_FILE, { type: 'text/csv' }), { exampleKey: EXAMPLE_FILE })
    } catch (cause) {
      setError(`Couldn’t load the example (${cause instanceof Error ? cause.message : String(cause)}). Open Data to try another.`)
    }
  }

  return (
    <div className="bench-empty" data-state="no-data">
      <h2>No data loaded yet</h2>
      <p>Pick an example dataset or upload a CSV. Probability works without data.</p>
      <div className="bench-empty-actions">
        <button type="button" className="sh-btn" onClick={() => setOpen(true)}>Open Data</button>
        <button type="button" className="sh-btn sh-btn-primary" onClick={() => { void useExample() }}>Use Electricity demand</button>
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
