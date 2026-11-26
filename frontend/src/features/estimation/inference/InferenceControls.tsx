import { useEffect, useRef } from 'react'
import type { CheckboxNode } from '../../../components/CheckboxTree'
import { SelectField, TextField } from '../../../components/ControlPrimitives'
import DualInput from '../../../components/DualInput'
import { LABELS, confidenceReadout, estimatorOptions } from '../../../labels'
import { INTERVAL_TREE, selectionInfo } from './inferenceOptions'
import type { InferenceState } from './useInferenceTabState'
import InputsFrame from '../shared/InputsFrame'
import { Option, OptionGroup } from '../shared/Options'
import { IntervalFx, RegionFx, optionRow } from './IntervalFx'

const ALPHA = { min: 0.001, max: 0.5, step: 0.001, decimals: 3 }
const BOOTSTRAP = { min: 100, max: 5000, step: 100, decimals: 0 }
const [ciNode, piNode] = INTERVAL_TREE
const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/** The interval options as ticks: a method shows its own options only while it is ticked, as before. */
function Tree({ nodes, selected, onChange, sigmaEstimator }: { nodes: readonly CheckboxNode[]; selected: readonly string[]; onChange: (next: string[]) => void; sigmaEstimator: string }) {
  const toggle = (id: string) => (checked: boolean) => onChange(checked ? [...selected, id] : selected.filter((item) => item !== id))
  return (
    <>
      {nodes.map((node) => {
        const stands = optionRow(node.id, sigmaEstimator)
        return (
          <Option key={node.id} checked={selected.includes(node.id)} onChange={toggle(node.id)} label={node.label}
            fx={stands ? <IntervalFx kind={stands.kind} row={stands.row} sigmaEstimator={sigmaEstimator} name={stands.name} /> : undefined}
            detail={node.children ? <Tree nodes={node.children} selected={selected} onChange={onChange} sigmaEstimator={sigmaEstimator} /> : undefined} />
        )
      })}
    </>
  )
}

export default function InferenceControls({ state }: { state: InferenceState }) {
  const { draft, setDraft, fieldErrors, activate, resetGeneration, picked } = state
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { activate() }, [activate])
  useEffect(() => {
    if (Object.keys(fieldErrors).length) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [fieldErrors])

  const isRegions = draft.estimationType === 'Confidence Regions'
  const info = selectionInfo(draft.selected)
  const alpha = Number(draft.alphaStr)
  const validAlpha = draft.alphaStr.trim() !== '' && Number.isFinite(alpha) && alpha > 0 && alpha < 1

  const alphaInput = <DualInput label={LABELS.alpha} value={clamp(alpha, ALPHA.min, ALPHA.max, 0.05)} min={ALPHA.min} max={ALPHA.max} step={ALPHA.step} decimals={ALPHA.decimals}
    onChange={value => setDraft({ alphaStr: value.toFixed(ALPHA.decimals) })}
    textValue={draft.alphaStr} onTextChange={alphaStr => setDraft({ alphaStr })} resetSignal={resetGeneration}
    hint={validAlpha ? `${confidenceReadout(alpha)}${isRegions ? ' for the marginal intervals' : ''}` : 'Enter a value between 0 and 1.'}
    error={fieldErrors.alphaStr} />

  const show = (
    <>
      <OptionGroup legend="Estimate">
        <Option kind="radio" name="estimate" checked={!isRegions} onChange={() => setDraft({ estimationType: 'Confidence and Prediction Intervals' })} label="Intervals" />
        <Option kind="radio" name="estimate" checked={isRegions} onChange={() => setDraft({ estimationType: 'Confidence Regions' })} label="Confidence regions"
          fx={<RegionFx withBox={draft.addCiBox} />} />
      </OptionGroup>
      {isRegions ? (
        <OptionGroup legend="Regions">
          <TextField label="Region coverage levels" value={draft.crProbs} onChange={crProbs => setDraft({ crProbs })}
            hint="Use proportions: 0.5, 0.95 means 50%, 95%. These levels control the contours." error={fieldErrors.crProbs} />
          <Option checked={draft.addCiBox} onChange={addCiBox => setDraft({ addCiBox })} label="Show marginal confidence interval box" />
        </OptionGroup>
      ) : (
        <>
          {/* The top-level 'ci' / 'pi' ticks stay on; each group shows only the methods under it. */}
          <OptionGroup legend={ciNode.label}>
            <Tree nodes={ciNode.children!} selected={draft.selected} onChange={selected => setDraft({ selected })} sigmaEstimator={draft.sigmaEst} />
          </OptionGroup>
          <OptionGroup legend={piNode.label}>
            <Tree nodes={piNode.children!} selected={draft.selected} onChange={selected => setDraft({ selected })} sigmaEstimator={draft.sigmaEst} />
          </OptionGroup>
          {fieldErrors.selected && <p role="alert" className="est-error">{fieldErrors.selected}</p>}
        </>
      )}
    </>
  )

  const settings = (
    <div className="est-settings">
      {(!isRegions || draft.addCiBox) && alphaInput}
      {!isRegions && info.needsDeviationEstimator && (
        <SelectField label={LABELS.sigmaEstimator} value={draft.sigmaEst} onChange={sigmaEst => setDraft({ sigmaEst })}
          options={estimatorOptions([...new Set([draft.sigmaEst, ...state.deviationEstimators])])}
          hint="Scale used by the methods that assume normality." />
      )}
      {!isRegions && info.anyBootstrap && (
        <DualInput label={LABELS.bootstrapSamples} value={clamp(Number(draft.samplesStr), BOOTSTRAP.min, BOOTSTRAP.max, 1000)}
          min={BOOTSTRAP.min} max={BOOTSTRAP.max} step={BOOTSTRAP.step} decimals={BOOTSTRAP.decimals}
          onChange={value => setDraft({ samplesStr: String(Math.round(value)) })}
          textValue={draft.samplesStr} onTextChange={samplesStr => setDraft({ samplesStr })} resetSignal={resetGeneration}
          hint="Number of resamples. More resamples take longer; the results update after a moment." error={fieldErrors.samplesStr} />
      )}
      {Object.keys(fieldErrors).filter(key => key !== 'column').length > 0 && <p role="alert" className="est-error">Check the highlighted fields.</p>}
    </div>
  )

  return (
    <form onSubmit={event => { event.preventDefault(); void state.handleRun() }} noValidate>
      <InputsFrame rootRef={rootRef} loaded={!!state.sessionId} hasData={state.hasData} picked={picked} column={draft.column}
        columns={state.numericCols} onPick={column => setDraft({ column })} columnError={fieldErrors.column}
        show={show} settings={settings} onReset={state.handleReset} />
    </form>
  )
}
