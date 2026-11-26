// features/estimation/descriptive/DescriptiveTab.tsx
// Slots for the panels; the state lives in useDescriptiveTabState (owned by App).

import DescriptiveControls from './DescriptiveControls'
import DescriptiveObservation from './DescriptiveObservation'
import ResultsGate from '../shared/ResultsGate'
import type { DescriptiveState } from './useDescriptiveTabState'

export function ControlsSlot({ state }: { state: DescriptiveState }) {
  return <DescriptiveControls state={state} />
}

export function ObservationSlot({ state }: { state: DescriptiveState }) {
  // Until a variable is picked the results area only says what to do (step gating).
  if (!state.hasData || !state.picked) return <ResultsGate loaded={state.loaded} hasData={state.hasData} />
  return (
    <DescriptiveObservation result={state.result} config={state.config} rows={state.visibleRows} precision={state.precision}
      isComputing={state.isComputing} error={state.error} onRetry={state.handleRetry} warnings={state.warnings} />
  )
}

/** @deprecated The notebook panel is gone (its formulas moved to the ƒ buttons). Kept empty only so App.tsx compiles until the integrator drops its notebook slot. */
export function NotebookSlot(_props: { state: DescriptiveState }) {
  return null
}
