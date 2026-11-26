import GatePrompt from '../../../components/lab/GatePrompt'
import { useDrawer } from '../../../context/DrawerContext'
import './estimation.css'

/**
 * What the results area says until there is something to show: no data yet, no numeric variable in the data, or
 * no variable picked (the gate prompt of step gating). It is a status, so a screen reader hears it.
 */
export default function ResultsGate({ loaded, hasData }: { loaded: boolean; hasData: boolean }) {
  const { setOpen } = useDrawer()
  if (!loaded) {
    return (
      <div className="est-nodata">
        <GatePrompt title="No data loaded yet" text="Pick an example dataset or upload a CSV. Probability works without data." />
        <button type="button" className="lab-btn" onClick={() => setOpen(true)}>Open Data</button>
      </div>
    )
  }
  if (!hasData) {
    return <GatePrompt title="No numeric variable in this data" text="Open Data and check the column types, or choose another dataset." />
  }
  return <GatePrompt text="Step 1 on the left: choose the column you want to look at. The next steps open when you do." />
}
