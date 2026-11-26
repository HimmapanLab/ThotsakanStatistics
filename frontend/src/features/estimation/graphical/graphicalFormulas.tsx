// features/estimation/graphical/graphicalFormulas.tsx
// The formula behind each plot and overlay, for the ƒ buttons. The TeX is the old notebook panel's (written from
// core/estimation/graphical_json.py and graphical_analysis.py); the plain-language lines are the prototype's wording.

import FormulaButton from '../../../components/lab/FormulaButton'

export type GraphTopic = 'hist' | 'ecdf' | 'kde' | 'scott' | 'normal' | 'band'

const HISTOGRAM = String.raw`\hat{f}_j = \frac{n_j}{n\,h_j}, \quad n_j = \text{count in bin } j, \quad h_j = \text{bin width}`
const ECDF = String.raw`\hat{F}(x) = \frac{1}{n} \sum_{i=1}^{n} \mathbf{1}\{\, x_i \le x \,\}`
const KDE = String.raw`\hat{f}_h(x) = \frac{1}{n\,h} \sum_{i=1}^{n} \phi\!\left( \frac{x - x_i}{h} \right)`
const SCOTT = String.raw`h_{\text{Scott}} = s\, n^{-1/5}`
const DKW_BAND = String.raw`\hat{F}(x) \pm \varepsilon, \quad \varepsilon = \sqrt{\frac{\ln(2/\alpha)}{2n}}`
const NORMAL_DENSITY = String.raw`\hat{f}(x) = \frac{1}{\hat{\sigma}\sqrt{2\pi}} \exp\!\left( -\frac{(x - \hat{\mu})^{2}}{2\hat{\sigma}^{2}} \right)`
const NORMAL_CDF = String.raw`\hat{F}(x) = \Phi\!\left( \frac{x - \hat{\mu}}{\hat{\sigma}} \right)`

export interface GraphFormula { title: string; def: string; tex: string[] }

/** What a topic is and how it is computed. `ecdf` says which plot is on, so the normal model shows only its own curve. */
export function graphFormula(topic: GraphTopic, ecdf: boolean): GraphFormula {
  switch (topic) {
    case 'hist': return { title: 'Density of bin j', def: 'Bar areas sum to 1, so shapes stay comparable across bin counts.', tex: [HISTOGRAM] }
    case 'ecdf': return { title: 'Empirical CDF', def: 'Proportion of observations at or below x.', tex: [ECDF] }
    case 'kde': return {
      title: 'Kernel density estimator (Gaussian kernel, bandwidth h)',
      def: 'A smooth curve made by adding a small bell-shaped bump at each observation. The bandwidth h sets the width of the bumps. φ is the standard normal density.',
      tex: [KDE],
    }
    case 'scott': return {
      title: 'Bandwidth h (Scott’s rule)',
      def: 'The default bandwidth, computed from the sample standard deviation s (ddof = 1) and the sample size n.',
      tex: [SCOTT],
    }
    case 'normal': return {
      title: ecdf ? 'Normal model (cumulative)' : 'Normal model (density)',
      def: 'The normal curve that uses the sample mean and standard deviation as its mean and spread.',
      tex: [ecdf ? NORMAL_CDF : NORMAL_DENSITY],
    }
    case 'band': return {
      title: 'Confidence band (DKW)',
      def: 'The ECDF plus and minus ε: a band expected to contain the true distribution function with confidence 1 − α.',
      tex: [DKW_BAND],
    }
  }
}

/** The ƒ button of an option or a result row. `name` is what its accessible label says ("Formula for …"). */
export function GraphFx({ topic, ecdf, name }: { topic: GraphTopic; ecdf: boolean; name?: string }) {
  const found = graphFormula(topic, ecdf)
  return <FormulaButton title={name ?? found.title} tex={found.tex}><p>{found.def}</p></FormulaButton>
}
