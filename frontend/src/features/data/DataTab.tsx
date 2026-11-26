// features/data/DataTab.tsx
// The Data screen used to be a tab of its own. Data now lives in the rail and drawer (DataRail, DataDrawer) that
// LabBench places on every topic page, so this file only keeps the old full-width entry working until App.tsx stops
// mounting it: the same rail and drawer, side by side, with the drawer open.
import { useEffect } from 'react'
import { useDrawer } from '../../context/DrawerContext'
import DataDrawer from './DataDrawer'
import DataRail from './DataRail'

export default function DataTab() {
  const { setOpen } = useDrawer()
  useEffect(() => { setOpen(true) }, [setOpen])
  return (
    <div className="data-tab">
      <DataRail />
      <DataDrawer />
    </div>
  )
}
