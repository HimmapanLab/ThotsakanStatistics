// features/estimation/descriptive/descriptiveFormulas.tsx
// The formula behind each statistic, for the ƒ buttons on the options and on the result rows. The TeX is copied
// from core/estimation/descriptive.py (NumPy and SciPy defaults: linear quantiles, scipy.stats.trim_mean,
// mstats.winsorize, skew/kurtosis with bias=False), as it was in the old notebook panel. The plain-language
// lines are the prototype's wording.

import FormulaButton from '../../../components/lab/FormulaButton'

export const STAT_NAME: Readonly<Record<string, string>> = {
  minimum: 'Minimum', maximum: 'Maximum', quantiles: 'Quantiles', mean: 'Mean', median: 'Median', iqm: 'Interquartile mean',
  weighted_mean: 'Weighted mean', trimmed_mean: 'Trimmed mean', winsorized_mean: 'Winsorized mean', geometric_mean: 'Geometric mean',
  harmonic_mean: 'Harmonic mean', variance_0: 'Variance (ddof=0)', variance_1: 'Variance (ddof=1)', std_dev_0: 'Std dev (ddof=0)',
  std_dev_1: 'Std dev (ddof=1)', range: 'Range', aad: 'AAD (mean absolute deviation)', iqr: 'IQR (interquartile range)',
  mad: 'MAD (median absolute deviation)', skewness: 'Skewness', kurtosis: 'Kurtosis',
}

const STAT_DEF: Readonly<Record<string, string>> = {
  minimum: 'The smallest value in the data.',
  maximum: 'The largest value in the data.',
  quantiles: 'A value that leaves a chosen share p of the sorted data below it, interpolating between neighbouring values.',
  mean: 'The sum of the values divided by how many there are.',
  median: 'The middle value of the sorted data; with an even n, the average of the two middle values.',
  iqm: 'The mean of the middle half of the sorted data, after dropping the lowest and highest quarter.',
  weighted_mean: 'A mean in which each value counts with its own weight w.',
  trimmed_mean: 'The mean after dropping a share α of the lowest and of the highest values.',
  winsorized_mean: 'The mean after replacing the lowest and highest shares with the nearest kept values.',
  geometric_mean: 'The n-th root of the product of the values. Defined for positive values.',
  harmonic_mean: 'The number of values divided by the sum of their reciprocals. Defined for positive values.',
  variance_0: 'The average squared distance from the mean, dividing by n.',
  variance_1: 'The sum of squared distances from the mean, divided by n − 1.',
  std_dev_0: 'The square root of the variance that divides by n.',
  std_dev_1: 'The square root of the variance that divides by n − 1.',
  range: 'The largest value minus the smallest.',
  aad: 'The average distance of the values from their mean.',
  iqr: 'The 75th percentile minus the 25th percentile.',
  mad: 'The median of the distances of the values from the median.',
  skewness: 'A measure of how lopsided the distribution is, adjusted for the sample size.',
  kurtosis: 'A measure of how heavy the tails are, adjusted for the sample size. Not shifted: a normal curve gives 3.',
}

/** Under normality. The statistic is already consistent; the constant removes its finite-sample bias. */
const BIAS_CORRECTIONS = [
  { id: 'variance_0', label: 'Variance (ddof = 0)', tex: String.raw`s^{2} = \frac{n}{n - 1}\, s_0^{2}` },
  { id: 'std_dev_1', label: 'Std dev (ddof = 1)', tex: String.raw`\hat{\sigma} = \frac{s}{c_4(n)}, \quad c_4(n) = \sqrt{\frac{2}{n - 1}}\, \frac{\Gamma(n/2)}{\Gamma\left(\frac{n - 1}{2}\right)}` },
  { id: 'std_dev_0', label: 'Std dev (ddof = 0)', tex: String.raw`\hat{\sigma} = \sqrt{\frac{n}{n - 1}}\, \frac{s_0}{c_4(n)}` },
  { id: 'range', label: 'Range', tex: String.raw`\hat{\sigma} = \frac{R}{d_2(n)}` },
] as const

/** Under normality. The statistic converges to a multiple of σ; the constant makes it consistent for σ. */
const CONSISTENCY_CORRECTIONS = [
  { id: 'mad', label: 'MAD', tex: String.raw`\hat{\sigma} = \frac{\operatorname{MAD}}{\Phi^{-1}(0.75)} \approx 1.4826\,\operatorname{MAD}` },
  { id: 'iqr', label: 'IQR', tex: String.raw`\hat{\sigma} = \frac{\operatorname{IQR}}{2\,\Phi^{-1}(0.75)} \approx 0.7413\,\operatorname{IQR}` },
  { id: 'aad', label: 'AAD', tex: String.raw`\hat{\sigma} = \sqrt{\pi/2}\,\operatorname{AAD} \approx 1.2533\,\operatorname{AAD}` },
] as const

/** Sample central moments, used by the skewness and kurtosis. */
const MOMENTS = String.raw`m_k = \frac{1}{n} \sum_{i=1}^{n} (x_i - \bar{x})^{k}`

/** One formula per statistic (the table's own order). */
const FORMULAS: Readonly<Record<string, string>> = {
  minimum: String.raw`x_{(1)} = \min_i x_i`,
  maximum: String.raw`x_{(n)} = \max_i x_i`,
  quantiles: String.raw`\begin{aligned} Q(p) &= x_{(\lfloor h \rfloor)} + (h - \lfloor h \rfloor)\left( x_{(\lfloor h \rfloor + 1)} - x_{(\lfloor h \rfloor)} \right) \\ h &= (n - 1)\,p + 1 \end{aligned}`,
  mean: String.raw`\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i`,
  median: String.raw`\operatorname{median}(x) = \begin{cases} x_{((n+1)/2)} & n \text{ odd} \\ \frac{1}{2}\left( x_{(n/2)} + x_{(n/2+1)} \right) & n \text{ even} \end{cases}`,
  iqm: String.raw`\bar{x}_{0.25} = \frac{1}{n - 2k} \sum_{i=k+1}^{n-k} x_{(i)}, \quad k = \lfloor 0.25\, n \rfloor`,
  weighted_mean: String.raw`\bar{x}_{w} = \frac{\sum_{i=1}^{n} w_i\, x_i}{\sum_{i=1}^{n} w_i}`,
  trimmed_mean: String.raw`\bar{x}_{\alpha} = \frac{1}{n - 2k} \sum_{i=k+1}^{n-k} x_{(i)}, \quad k = \lfloor \alpha n \rfloor`,
  winsorized_mean: String.raw`\begin{aligned} \bar{x}_{W} &= \frac{1}{n} \sum_{i=1}^{n} \min\!\left( \max\!\left( x_i,\, x_{(k_1+1)} \right),\, x_{(n-k_2)} \right) \\ k_1 &= \lfloor \gamma_1 n \rfloor, \quad k_2 = \lfloor \gamma_2 n \rfloor \end{aligned}`,
  geometric_mean: String.raw`\bar{x}_{G} = \left( \prod_{i=1}^{n} x_i \right)^{1/n}, \quad x_i > 0`,
  harmonic_mean: String.raw`\bar{x}_{H} = \frac{n}{\sum_{i=1}^{n} 1/x_i}, \quad x_i > 0`,
  variance_0: String.raw`s_0^{2} = \frac{1}{n} \sum_{i=1}^{n} (x_i - \bar{x})^{2}`,
  variance_1: String.raw`s^{2} = \frac{1}{n - 1} \sum_{i=1}^{n} (x_i - \bar{x})^{2}`,
  std_dev_0: String.raw`s_0 = \sqrt{s_0^{2}}`,
  std_dev_1: String.raw`s = \sqrt{s^{2}}`,
  range: String.raw`R = x_{(n)} - x_{(1)}`,
  aad: String.raw`\operatorname{AAD} = \frac{1}{n} \sum_{i=1}^{n} \left| x_i - \bar{x} \right|`,
  iqr: String.raw`\operatorname{IQR} = Q(0.75) - Q(0.25)`,
  mad: String.raw`\operatorname{MAD} = \operatorname{median}_i \left| x_i - \operatorname{median}(x) \right|`,
  skewness: String.raw`\begin{aligned} G_1 &= \frac{\sqrt{n(n - 1)}}{n - 2} \, \frac{m_3}{m_2^{3/2}} \quad \text{(sample-adjusted)} \\ ${MOMENTS} \end{aligned}`.replace('m_k =', 'm_k &='),
  kurtosis: String.raw`\begin{aligned} \text{Kurtosis} &= G_2 + 3 \quad \text{(not excess; sample-adjusted)} \\ G_2 &= \frac{n - 1}{(n - 2)(n - 3)} \left[ (n + 1)\, g_2 + 6 \right] \\ g_2 &= \frac{m_4}{m_2^{2}} - 3 \\ ${MOMENTS} \end{aligned}`.replace('m_k =', 'm_k &='),
}

const CORRECTION_NOTE = 'The second formula is the normal correction, shown because Normal-corrected values is on (under normality).'

/** Formulas for one statistic: its own, then its normal correction when that column is on. */
export function statFormula(id: string, corrected: boolean): { title: string; def: string; tex: string[]; corrected: boolean } {
  const tex = FORMULAS[id] ? [FORMULAS[id]] : []
  const fix = corrected ? BIAS_CORRECTIONS.find((item) => item.id === id) ?? CONSISTENCY_CORRECTIONS.find((item) => item.id === id) : undefined
  if (fix) tex.push(fix.tex)
  return { title: STAT_NAME[id] ?? id, def: STAT_DEF[id] ?? '', tex, corrected: !!fix }
}

/**
 * The ƒ button of a statistic. It shows that statistic's formula only, and its normal correction only while the
 * corrected column is on. `note` adds a line (the constant c₄(n) behind the corrected standard deviation).
 */
export function StatFx({ id, corrected, note }: { id: string; corrected: boolean; note?: string }) {
  const found = statFormula(id, corrected)
  if (found.tex.length === 0) return null
  return (
    <FormulaButton title={found.title} tex={found.tex}>
      <p>{found.def}</p>
      {found.corrected && <p>{CORRECTION_NOTE}</p>}
      {found.corrected && note && <p>{note}</p>}
    </FormulaButton>
  )
}
