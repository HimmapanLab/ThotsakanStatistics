import type { ReactNode } from 'react'
import { useData } from '../../context/DataContext'
import { useDrawer } from '../../context/DrawerContext'
import { datasetTitle } from '../../features/data/ExampleDatasets'
import FilterChip from './FilterChip'
import StepBox from './StepBox'

/**
 * Step 1, "Data": which dataset is loaded, a "Filtered n of N" chip when a filter is on, and a Change button
 * that opens the Data drawer. A page puts its first input (the variable) inside as `children`.
 */
export function DataStep({ children }: { children?: ReactNode } = {}) {
  const { state } = useData()
  const { setOpen } = useDrawer()
  const loaded = !!state.dataset
  return (
    <StepBox n={1} title="Data">
      <div className="lab-dataline">
        <strong>{loaded ? datasetTitle(state.filename) : 'No data loaded'}</strong>
        <FilterChip />
        <button type="button" className="lab-btn-quiet" onClick={() => setOpen(true)}>
          {loaded ? 'Change' : 'Choose data'}
        </button>
      </div>
      {children}
    </StepBox>
  )
}

export default DataStep
