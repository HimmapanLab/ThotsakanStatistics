import HypothesisControls from './HypothesisControls';
import HypothesisObservation from './HypothesisObservation';
import type { HypothesisTabState } from './useHypothesisTabState';

export function ControlsSlot({ state }: { state: HypothesisTabState }) {
  return <HypothesisControls state={state} />;
}

/** The results. Warnings stay inside the observation, under the table they belong to. */
export function ObservationSlot({ state }: { state: HypothesisTabState }) {
  return <HypothesisObservation result={state.result} hasData={state.hasData && state.numericCols.length > 0}
    loaded={state.hasData} picked={state.picked} column={state.draft.column} precision={state.precision}
    isComputing={state.isComputing} isDirty={state.isDirty} error={state.error} onRetry={state.handleRetry} />;
}

/** The formulas now live in the ƒ popovers. Kept as an empty slot only until App.tsx stops importing it. */
export function NotebookSlot(_props: { state: HypothesisTabState }) {
  return null;
}
