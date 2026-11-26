import GraphicalControls from './GraphicalControls'
import GraphicalObservation from './GraphicalObservation'
import ResultsGate from '../shared/ResultsGate'
import type { GraphicalTabState } from './useGraphicalTabState'

interface SlotProps { state: GraphicalTabState }

export function ControlsSlot({ state }: SlotProps) {
  return <GraphicalControls state={state} />
}

export function ObservationSlot({ state }: SlotProps) {
  // Until a variable is picked the results area only says what to do (step gating).
  if (!state.hasData || !state.picked) return <ResultsGate loaded={!!state.sessionId} hasData={state.hasData} />
  return (
    <GraphicalObservation result={state.result} column={state.column} graphType={state.graphType} precision={state.precision}
      isComputing={state.isComputing} error={state.error} onRetry={state.retry} warnings={state.warnings} />
  )
}

/** @deprecated The notebook panel is gone (its formulas moved to the ƒ buttons). Kept empty only so App.tsx compiles until the integrator drops its notebook slot. */
export function NotebookSlot(_props: SlotProps) {
  return null
}
