import { useId, useState } from 'react'
import { AnalysisActions, RadioGroup, SelectField, SwitchField, TextField } from '../../components/ControlPrimitives'
import DualInput from '../../components/DualInput'
import { DataStep, FormulaButton, LockedStep, StepBox } from '../../components/lab'
import { EQUAL_VARIANCE, ONE_SAMPLE_T, ONE_WAY_ANOVA, TEST_TYPES, TWO_SAMPLE_T, type Alternative } from '../../api/hypothesis'
import { LABELS, confidenceReadout } from '../../labels'
import { useDrawer } from '../../context/DrawerContext'
import { haptic } from '../../lib/haptics'
import GroupBuilder from './GroupBuilder'
import { testFit } from './testFit'
import { HYP_FORMULA_NOTE } from './ui/formulaNotes'
import { useJustOpened } from './ui/blocks'
import type { HypothesisTabState } from './useHypothesisTabState'

const alternatives: { value: Alternative; label: string }[] = [
  { value: 'two-sided', label: 'Different from (≠)' },
  { value: 'greater', label: 'Greater than (>)' },
  { value: 'less', label: 'Less than (<)' },
]


/**
 * The inputs, as numbered steps (step gating, decisions.md 2026-11-26). Step 1 is the data and the variable.
 * Until a variable is picked the later steps show only their names; once it is picked they open and stay
 * open. Only a step that has just opened animates, and a touch that opens it buzzes once.
 */
export default function HypothesisControls({ state }: { state: HypothesisTabState }) {
  const id = useId()
  const { draft, setDraft, validationErrors: errors, picked } = state
  const justOpened = useJustOpened(picked)
  const needsGroups = draft.testType === TWO_SAMPLE_T || draft.testType === EQUAL_VARIANCE
  const isAnova = draft.testType === ONE_WAY_ANOVA
  const needsCategories = needsGroups || isAnova
  const showAlternative = draft.testType === ONE_SAMPLE_T || draft.testType === TWO_SAMPLE_T
  const overlapping = needsGroups && draft.group1.column === draft.group2.column &&
    draft.group1.values.some(value => draft.group2.values.includes(value))
  const alpha = Number(draft.alphaStr)
  const sliderAlpha = !errors.alphaStr && Number.isFinite(alpha) ? alpha : 0.05
  const [resetGeneration, setResetGeneration] = useState(0)
  const empty = state.numericCols.length === 0
  const noGroupColumns = state.categoricalCols.length === 0
  const drawer = useDrawer()

  const pickVariable = (column: string) => {
    if (!picked) haptic('step')
    setDraft({ column })
  }

  return (
    <form className="hp-steps" onSubmit={event => event.preventDefault()}>
      <DataStep>
        <SelectField label="Variable" value={empty ? '' : draft.column} onChange={pickVariable} options={state.numericCols}
          error={errors.column && picked ? errors.column : undefined} disabled={empty}
          placeholder={empty ? (state.hasData ? '— no numeric variables —' : '— no dataset loaded —') : 'Pick a variable'}
          hint={empty ? (state.hasData ? 'Check the column types in the Data drawer.' : 'Choose data to start.') : undefined} />
      </DataStep>

      {!picked ? <>
        <LockedStep n={2} title="Test" after={1} />
        <LockedStep n={3} title="Settings" after={1} />
      </> : <>
        <StepBox n={2} title="Test" isNew={justOpened}>
          <fieldset className="hp-opts">
            <legend className="sr-only">Test</legend>
            {TEST_TYPES.map((test) => {
              // A test the data cannot run is greyed with the reason, unless it is the one already chosen.
              const fit = testFit(test, state.groupColumns)
              if (!fit.ok && draft.testType !== test) {
                return (
                  <div key={test} className="hp-gated" onClick={() => haptic('refuse')}>
                    <label className="hp-check"><input type="radio" name={`${id}-test`} disabled /><span>{test}</span></label>
                    <p className="hp-why">{fit.reason}{' '}
                      <button type="button" className="hp-why-link" onClick={(event) => { event.stopPropagation(); drawer.setOpen(true) }}>Show me in Data</button></p>
                  </div>
                )
              }
              return (
                <div key={test} className="hp-opt">
                  <label className="hp-check">
                    <input type="radio" name={`${id}-test`} checked={draft.testType === test} onChange={() => setDraft({ testType: test })} />
                    <span>{test}</span>
                  </label>
                  <FormulaButton title={test}>{HYP_FORMULA_NOTE}</FormulaButton>
                </div>
              )
            })}
          </fieldset>
        </StepBox>

        <StepBox n={3} title="Settings" isNew={justOpened}>
          <div className="hp-stack">
            {draft.testType === ONE_SAMPLE_T && <TextField label="Null value μ₀" value={draft.mu0Str}
              onChange={mu0Str => setDraft({ mu0Str })} inputMode="decimal" error={errors.mu0Str}
              hint="The population mean claimed by H0." placeholder="e.g. 30" />}

            {showAlternative && <RadioGroup label="Alternative H1" value={draft.alternative}
              onChange={alternative => setDraft({ alternative })} options={alternatives} />}

            {draft.testType === TWO_SAMPLE_T && <SwitchField label="Welch correction (unequal variances)"
              checked={draft.correction} onChange={correction => setDraft({ correction })} />}
            {draft.testType === EQUAL_VARIANCE && <SelectField label="Variance test" value={draft.varianceTestType}
              onChange={varianceTestType => setDraft({ varianceTestType })} options={['Levene', 'Bartlett']} />}

            {needsCategories && noGroupColumns ? <p className="hp-note">
              Mark a grouping column as categorical in Data → Column Types.
            </p> : <>
              {needsGroups && <>
                <GroupBuilder label="Group 1" value={draft.group1} onChange={group1 => setDraft({ group1 })} categoricalCols={state.categoricalCols} sampleCount={state.groupCounts[0]} describedBy={errors.groups ? `${id}-groups` : undefined} />
                <GroupBuilder label="Group 2" value={draft.group2} onChange={group2 => setDraft({ group2 })} categoricalCols={state.categoricalCols} sampleCount={state.groupCounts[1]} describedBy={errors.groups ? `${id}-groups` : undefined} />
                {overlapping && <p className="hp-note is-warn">These groups share categories. A two-sample test assumes independent groups.</p>}
              </>}
              {isAnova && <GroupBuilder label="Factor" value={draft.anovaGroup} onChange={anovaGroup => setDraft({ anovaGroup })} categoricalCols={state.categoricalCols} showName={false} describedBy={errors.groups ? `${id}-groups` : undefined} />}
            </>}
            {errors.groups && !noGroupColumns && <p id={`${id}-groups`} className="hp-note">{errors.groups}</p>}

            <DualInput label={LABELS.alpha} value={sliderAlpha} min={0.001} max={0.5} step={0.001} decimals={3}
              onChange={value => setDraft({ alphaStr: value.toFixed(3) })}
              textValue={draft.alphaStr} onTextChange={alphaStr => setDraft({ alphaStr })}
              resetSignal={resetGeneration}
              hint={errors.alphaStr ? undefined : confidenceReadout(sliderAlpha)}
              error={errors.alphaStr} />

            <AnalysisActions onReset={() => { setResetGeneration(value => value + 1); state.handleReset() }} />
          </div>
        </StepBox>
      </>}
    </form>
  )
}
