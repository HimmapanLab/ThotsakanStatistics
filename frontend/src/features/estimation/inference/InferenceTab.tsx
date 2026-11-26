import InferenceControls from './InferenceControls'
import InferenceObservation from './InferenceObservation'
import ResultsGate from '../shared/ResultsGate'
import type { InferenceState } from './useInferenceTabState'

export function ControlsSlot({ state }: { state: InferenceState }) {
  return <InferenceControls state={state} />
}
export function ObservationSlot({ state }: { state: InferenceState }) {
  // Until a variable is picked the results area only says what to do (step gating).
  if (!state.hasData || !state.picked) return <ResultsGate loaded={!!state.sessionId} hasData={state.hasData} />
  return <InferenceObservation state={state} />
}

/** @deprecated The notebook panel is gone (its formulas moved to the ƒ buttons). Kept empty only so App.tsx compiles until the integrator drops its notebook slot. */
export function NotebookSlot(_props: { state: InferenceState }) {
  return null
}
