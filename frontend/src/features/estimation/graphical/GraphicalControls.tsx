// features/estimation/graphical/GraphicalControls.tsx
// Inputs of Graphical Analysis, in steps: 1 Data (with the variable), 2 What to show (plot type and overlays),
// 3 Settings (bins, bandwidth, band level, the estimators behind the normal model). Everything updates the plot
// automatically; there is no Run button.

import { useEffect, useRef } from 'react'
import type { GraphicalTabState } from './useGraphicalTabState'
import DualInput from '../../../components/DualInput'
import { SelectField, SwitchField, TextField } from '../../../components/ControlPrimitives'
import type { GraphType } from '../../../api/graphical'
import { haptic } from '../../../lib/haptics'
import { LABELS, confidenceReadout, estimatorOptions } from '../../../labels'
import { BOUNDS, supportedOverlays } from './graphicalState'
import InputsFrame from '../shared/InputsFrame'
import { Option, OptionGroup } from '../shared/Options'

/** Bandwidth slider: from a fifth to five times the default h, in about a hundred steps. */
function bandwidthRange(defaultH: number) {
  const step = Number((defaultH / 20).toPrecision(1))
  return { min: defaultH / 5, max: defaultH * 5, step, decimals: Math.max(0, -Math.floor(Math.log10(step))) }
}

export default function GraphicalControls({ state }: { state: GraphicalTabState }) {
  const { cfg, picked, winsorRaw, autoBins, sessionId, numericCols, muEstimators, deviationEstimators,
    fieldErrors, resetVersion, updateConfig: set, hasData, kdeDefault,
    setWinsorRaw, setAutoBins, reset } = state
  const rootRef = useRef<HTMLDivElement>(null)
  const shows = supportedOverlays(cfg.graphType)
  const isEcdf = cfg.graphType === 'ECDF'
  const hist = !isEcdf

  useEffect(() => {
    if (Object.keys(fieldErrors).length) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [fieldErrors])

  const refuse = () => haptic('refuse')

  const show = (
    <>
      <OptionGroup legend="Plot type">
        <Option kind="radio" name="graph-type" checked={hist} onChange={() => set('graphType', 'Histogram' as GraphType)} label="Histogram" />
        <Option kind="radio" name="graph-type" checked={isEcdf} onChange={() => set('graphType', 'ECDF' as GraphType)}
          label="ECDF (empirical cumulative distribution function)" />
      </OptionGroup>
      <OptionGroup legend="Overlays">
        <Option checked={shows.kde && cfg.addKde} gated={!shows.kde} why="Histogram only." onGatedTouch={refuse}
          onChange={(on) => set('addKde', on)} label="KDE (kernel density estimator)" />
        <Option checked={cfg.addNormal} onChange={(on) => set('addNormal', on)} label="Normal model" />
        <Option checked={shows.confBand && cfg.addConfBand} gated={!shows.confBand} why="ECDF only." onGatedTouch={refuse}
          onChange={(on) => set('addConfBand', on)} label="Confidence band" />
      </OptionGroup>
    </>
  )

  const nothingToSet = !shows.bins && !(shows.confBand && cfg.addConfBand) && !cfg.addNormal
  const settings = (
    <div className="est-settings">
      {shows.bins && (
        <>
          <SwitchField label="Automatic bin count" checked={autoBins} onChange={setAutoBins} />
          {!autoBins && (
            <DualInput label="Bins" value={cfg.bins ?? 20} min={BOUNDS.bins.min} max={BOUNDS.bins.max} step={BOUNDS.bins.step}
              decimals={0} resetSignal={resetVersion} onChange={(v) => set('bins', v)} />
          )}
        </>
      )}

      {shows.kde && cfg.addKde && kdeDefault !== null && (
        <DualInput label="Bandwidth h (Scott’s rule by default)" value={cfg.kdeBandwidth ?? kdeDefault} {...bandwidthRange(kdeDefault)}
          hint="Starts at Scott's rule. Smaller h follows the data closely; larger h smooths more."
          resetSignal={`${resetVersion}:${cfg.column}`} onChange={(v) => set('kdeBandwidth', v)} />
      )}

      {shows.confBand && cfg.addConfBand && (
        <DualInput label={LABELS.alpha} value={cfg.alpha} min={BOUNDS.alpha.min} max={BOUNDS.alpha.max} step={BOUNDS.alpha.step}
          decimals={3} hint={confidenceReadout(cfg.alpha)} resetSignal={resetVersion} onChange={(v) => set('alpha', v)} />
      )}

      {cfg.addNormal && (
        <>
          <SelectField label={LABELS.muEstimator} value={cfg.muEstimator} onChange={(v) => set('muEstimator', v)}
            options={estimatorOptions(muEstimators)} />
          {cfg.muEstimator === 'Trimmed Mean' && (
            <DualInput label={LABELS.trimFraction} value={cfg.trimParam ?? 0.1} min={BOUNDS.trim.min} max={BOUNDS.trim.max}
              step={BOUNDS.trim.step} decimals={2} resetSignal={resetVersion} onChange={(v) => set('trimParam', v)} />
          )}
          {cfg.muEstimator === 'Winsorized Mean' && (
            <TextField label={LABELS.winsorFractions} value={winsorRaw} onChange={setWinsorRaw} placeholder="0.1, 0.1"
              hint="Fraction to replace in each tail; two values from 0 up to 0.5." error={fieldErrors.winsorLimits} />
          )}
          {cfg.muEstimator === 'Weighted Mean' && (
            <SelectField label={LABELS.weightsColumn} value={cfg.weightsColumn ?? ''} onChange={(v) => set('weightsColumn', v || null)}
              options={numericCols.filter((c) => c !== cfg.column)} error={fieldErrors.weightsColumn}
              placeholder="— select column —" />
          )}
          <SelectField label={LABELS.sigmaEstimator} value={cfg.sigmaEstimator} onChange={(v) => set('sigmaEstimator', v)}
            options={estimatorOptions(deviationEstimators)} />
        </>
      )}

      {nothingToSet && <p className="est-hint">Switch on an overlay to see its settings.</p>}
    </div>
  )

  return (
    <InputsFrame rootRef={rootRef} loaded={!!sessionId} hasData={hasData} picked={picked} column={cfg.column} columns={numericCols}
      onPick={(column) => set('column', column)} columnError={fieldErrors.column}
      show={show} settings={settings} onReset={reset} />
  )
}
