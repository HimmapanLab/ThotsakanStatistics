// features/estimation/inference/IntervalFx.tsx
// The ƒ buttons of Statistical Inference: one for an interval option or a result row, one for the confidence
// regions. The TeX comes from inferenceFormulas.ts (written from backend/core/estimation/inference); the plain-language
// lines are the prototype's wording. Each button shows only the formula of what it sits beside.

import FormulaButton from '../../../components/lab/FormulaButton'
import MathFormula from '../../../components/MathFormula'
import { estimatorLabel } from '../../../labels'
import { intervalFormula, NOTATION, REGION_BOX, REGION_FORMULAS } from './inferenceFormulas'
import { quantityLabel, type IntervalRow } from './inferencePresentation'

const INT_DEF: Readonly<Record<string, string>> = {
  'confidence|Mean': 'A range for the true mean, built from the sample mean and its standard error.',
  'confidence|Median': 'A range for the true median, using the normal approximation for the sample median.',
  'confidence|Deviation': 'A range for the true standard deviation σ.',
  'prediction|Mean': 'A range expected to contain a new observation, centred on the mean.',
  'prediction|Median': 'A range expected to contain a new observation, centred on the median.',
  'prediction|IQR': 'A range expected to contain a new observation, built from the quartiles and the IQR.',
  'prediction|Bootstrap': 'A range expected to contain a new observation, from resampling the data.',
}

type Kind = 'confidence' | 'prediction'

/** The symbols the formula uses, in the order a reader meets them. */
function Notation({ sigmaEstimator }: { sigmaEstimator: string }) {
  return (
    <ul className="est-notation">
      {NOTATION.map((item) => (
        <li key={item.tex}>
          <MathFormula inline tex={item.tex} />{' '}
          {item.namesEstimator ? `${item.text} (${estimatorLabel(sigmaEstimator)})` : item.text}
        </li>
      ))}
    </ul>
  )
}

/** The ƒ button of one interval (an option on the left, a row of the table). `name` is what its label says ("Formula for …"). */
export function IntervalFx({ kind, row, sigmaEstimator, name }: {
  kind: Kind
  row: Pick<IntervalRow, 'Statistic' | 'Method'>
  sigmaEstimator: string
  name: string
}) {
  const formula = intervalFormula(kind, row, sigmaEstimator)
  const quantity = quantityLabel(row.Statistic)
  return (
    <FormulaButton title={name} tex={formula.tex}>
      <p><strong>{(kind === 'confidence' ? 'Confidence interval' : 'Prediction interval') + ': ' + formula.label}</strong></p>
      {INT_DEF[`${kind}|${quantity}`] && <p>{INT_DEF[`${kind}|${quantity}`]}</p>}
      <Notation sigmaEstimator={sigmaEstimator} />
    </FormulaButton>
  )
}

/**
 * The row a tick stands for, before any result exists. The method names follow services/inference.py: the mean uses t
 * while the deviation estimator is the default (ddof = 1), and the normal z otherwise.
 */
export function optionRow(id: string, sigmaEstimator: string): { kind: Kind; row: Pick<IntervalRow, 'Statistic' | 'Method'>; name: string } | null {
  const usesT = sigmaEstimator === 'Deviation (1 ddof)'
  const mean = usesT ? 't (df=n-1)' : `Normal (z, ${sigmaEstimator})`
  const boot = 'Bootstrap'
  switch (id) {
    case 'ci.mean.normal': return { kind: 'confidence', row: { Statistic: 'Mean', Method: mean }, name: 'confidence interval for the mean, assuming normality' }
    case 'ci.mean.boot': return { kind: 'confidence', row: { Statistic: 'Mean', Method: boot }, name: 'confidence interval for the mean, bootstrap' }
    case 'ci.median.normal': return { kind: 'confidence', row: { Statistic: 'Median', Method: 'Normal (asymptotic)' }, name: 'confidence interval for the median, assuming normality' }
    case 'ci.median.boot': return { kind: 'confidence', row: { Statistic: 'Median', Method: boot }, name: 'confidence interval for the median, bootstrap' }
    case 'ci.deviation.normal': return { kind: 'confidence', row: { Statistic: 'Deviation', Method: usesT ? 'Chi-square (s, ddof=1)' : 'Normal (asymptotic)' }, name: 'confidence interval for the deviation, assuming normality' }
    case 'ci.deviation.boot': return { kind: 'confidence', row: { Statistic: 'Deviation', Method: boot }, name: 'confidence interval for the deviation, bootstrap' }
    case 'pi.normal.mean': return { kind: 'prediction', row: { Statistic: 'Mean', Method: mean }, name: 'prediction interval based on the mean' }
    case 'pi.normal.median': return { kind: 'prediction', row: { Statistic: 'Median', Method: 'Normal (asymptotic)' }, name: 'prediction interval based on the median' }
    case 'pi.normal.iqr': return { kind: 'prediction', row: { Statistic: 'IQR', Method: 'IQR (normal-scaled)' }, name: 'prediction interval based on the IQR' }
    case 'pi.boot': return { kind: 'prediction', row: { Statistic: 'Bootstrap', Method: boot }, name: 'prediction interval, bootstrap' }
    default: return null
  }
}

/** How the joint confidence regions are built (and the dashed box, when it is on). */
export function RegionFx({ withBox }: { withBox: boolean }) {
  const blocks = [...REGION_FORMULAS.map((item) => item.tex), ...(withBox ? [REGION_BOX.tex] : [])]
  return (
    <FormulaButton title="confidence regions" tex={blocks}>
      <p>Each region is the set of (μ, σ) whose relative likelihood stays above a cut-off set by its coverage.</p>
      <ol className="est-notation">
        {REGION_FORMULAS.map((item) => <li key={item.label}>{item.label}</li>)}
        {withBox && <li>{REGION_BOX.label}</li>}
      </ol>
    </FormulaButton>
  )
}
