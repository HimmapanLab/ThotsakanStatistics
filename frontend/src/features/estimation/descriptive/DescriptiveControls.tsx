// features/estimation/descriptive/DescriptiveControls.tsx
// Inputs of Descriptive Statistics, in steps: 1 Data (with the variable), 2 What to show (basic and advanced
// statistics), 3 Settings (the normal-corrected column). A pure view of the tab state; results update
// automatically and the hook only refetches when a *request* field changes.

import type { ReactNode } from 'react'
import { SelectField, SwitchField, TextField } from '../../../components/ControlPrimitives'
import { LABELS } from '../../../labels'
import { ADVANCED_GROUPS, BASIC_TREE } from './descriptiveOptions'
import type { DescriptiveState } from './useDescriptiveTabState'
import InputsFrame from '../shared/InputsFrame'
import { Option, OptionGroup, SubHead } from '../shared/Options'
import { StatFx } from './descriptiveFormulas'

const DEFAULT_QUANTILES = '0.25, 0.5, 0.75'

export default function DescriptiveControls({ state }: { state: DescriptiveState }) {
  const { draft, setDraft, fieldErrors, numericCols, picked } = state

  const on = (id: string) => draft.selected.includes(id)
  const toggle = (id: string) => (checked: boolean) =>
    setDraft({ selected: checked ? [...draft.selected, id] : draft.selected.filter((item) => item !== id) })

  const detailFor: Record<string, ReactNode> = {
    quantiles: (
      <TextField label="Quantile probabilities" value={draft.quantilesRaw} onChange={(quantilesRaw) => setDraft({ quantilesRaw })}
        placeholder={DEFAULT_QUANTILES} hint="Comma-separated, from 0 to 1. Leave empty for none."
        error={fieldErrors.quantilesRaw} />
    ),
    trimmed_mean: (
      <TextField label={LABELS.trimFraction} value={draft.trimRaw} onChange={(trimRaw) => setDraft({ trimRaw })}
        placeholder="0.10" hint="Fraction to trim from each tail."
        error={fieldErrors.trimRaw} inputMode="decimal" />
    ),
    winsorized_mean: (
      <TextField label={LABELS.winsorFractions} value={draft.winsorRaw} onChange={(winsorRaw) => setDraft({ winsorRaw })}
        placeholder="0.10, 0.10" hint="Comma-separated pair from 0 up to, but not including, 0.5."
        error={fieldErrors.winsorRaw} />
    ),
    weighted_mean: (
      <SelectField label={LABELS.weightsColumn} value={draft.weightsCol} onChange={(weightsCol) => setDraft({ weightsCol })}
        options={numericCols.filter((c) => c !== draft.column)} placeholder="— choose a column —"
        hint={draft.weightsCol ? undefined : 'Weighted mean needs a weights column.'} />
    ),
  }
  const option = (id: string, label: string) => (
    <Option key={id} checked={on(id)} onChange={toggle(id)} label={label} detail={detailFor[id]}
      fx={<StatFx id={id} corrected={draft.showConsistencyCorr} />} />
  )

  const show = (
    <>
      <OptionGroup legend="Basic">
        {BASIC_TREE.map((node) => node.children ? (
          <div key={node.id}>
            <SubHead>{node.label}</SubHead>
            {node.children.map((child) => option(child.id, child.label))}
          </div>
        ) : (
          <div key={node.id}>
            <SubHead>{node.label}</SubHead>
            {option(node.id, node.label)}
          </div>
        ))}
      </OptionGroup>
      <details className="est-adv" open={draft.advancedOpen} onToggle={(event) => {
        const open = event.currentTarget.open
        if (open !== draft.advancedOpen) setDraft({ advancedOpen: open })
      }}>
        <summary>Advanced</summary>
        {ADVANCED_GROUPS.map(({ title, items }) => (
          <div key={title}>
            <SubHead>{title}</SubHead>
            {items.map((item) => option(item.id, item.label))}
          </div>
        ))}
      </details>
    </>
  )

  const settings = (
    <div className="est-settings">
      <SwitchField label="Normal-corrected values" checked={draft.showConsistencyCorr}
        onChange={(showConsistencyCorr) => setDraft({ showConsistencyCorr })}
        hint="Adds a column that rescales each spread measure so it estimates σ if the data are normal." />
    </div>
  )

  return (
    <InputsFrame loaded={state.loaded} hasData={state.hasData} picked={picked} column={draft.column} columns={numericCols}
      onPick={(column) => setDraft({ column })} columnError={fieldErrors.column}
      show={show} settings={settings} onReset={state.handleReset} />
  )
}
