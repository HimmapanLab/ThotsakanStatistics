import { useRef, type ReactNode, type RefObject } from 'react'
import { SelectField } from '../../../components/ControlPrimitives'
import DataStep from '../../../components/lab/DataStep'
import LockedStep from '../../../components/lab/LockedStep'
import StepBox from '../../../components/lab/StepBox'
import { haptic } from '../../../lib/haptics'
import { useStepReveal } from './useStepReveal'
import './estimation.css'

/** What the steps after "Data" are called while they wait (the prototype's LOCKED). */
export const STATS_STEPS = ['What to show', 'Settings'] as const

/**
 * The inputs of a Statistics page, in steps (decisions.md 2026-11-26): step 1 "Data" holds the dataset line and the
 * variable. The steps after it open together once a variable is picked, and then never fold away. Until then they
 * show only their name. Only steps that have just opened animate and announce themselves, and a touch that opens
 * them buzzes once (haptic('step')).
 */
export default function InputsFrame({ loaded, hasData, picked, column, columns, onPick, columnError, show, settings, onReset, rootRef }: {
  /** A dataset is loaded (it may have no numeric variable). */
  loaded: boolean
  hasData: boolean
  picked: boolean
  column: string
  columns: readonly string[]
  onPick: (column: string) => void
  columnError?: string
  /** Step 2. */
  show: ReactNode
  /** Step 3. */
  settings: ReactNode
  onReset: () => void
  rootRef?: RefObject<HTMLDivElement | null>
}) {
  const reveal = useStepReveal(picked)
  const ownRef = useRef<HTMLDivElement>(null)
  const ref = rootRef ?? ownRef
  const pick = (value: string) => {
    if (!picked && value) haptic('step') // a step opens: only a direct touch buzzes (see lib/haptics.ts)
    onPick(value)
  }
  return (
    <div ref={ref} className="est-inputs">
      <DataStep>
        {loaded && (
          <SelectField label="Variable" value={picked ? column : ''} onChange={pick} options={columns}
            disabled={!hasData} placeholder={hasData ? 'Pick a variable' : 'No numeric variable in this data'}
            error={picked ? columnError : undefined}
            hint={hasData ? undefined : 'Open Data and check the column types.'} />
        )}
      </DataStep>
      {loaded && (picked ? (
        <>
          <StepBox n={2} title={STATS_STEPS[0]} isNew={reveal}>{show}</StepBox>
          <StepBox n={3} title={STATS_STEPS[1]} isNew={reveal}>{settings}</StepBox>
          <button type="button" className="lab-btn est-reset" onClick={onReset}>Reset to defaults</button>
        </>
      ) : (
        <>
          <LockedStep n={2} title={STATS_STEPS[0]} />
          <LockedStep n={3} title={STATS_STEPS[1]} />
        </>
      ))}
    </div>
  )
}
