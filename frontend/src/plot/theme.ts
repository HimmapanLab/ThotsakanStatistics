/**
 * Shared Plotly look (docs/interaction_contract.md, rule 17). Plotly cannot read CSS variables, so the
 * values are mirrored here from design/tokens.css (the --q-*, --h-*, --p-* and --plot-* tokens). Semantic names, not hex literals, go in chart code; switching
 * theme later means changing the values in this file only.
 *
 * Color rule (Irving Gomez, 2026-10-24): within one tab a color has one meaning; each tab assigns the
 * palette where it reads best, so a hue may mean different things in different tabs (rose is Extremes in
 * Descriptive, prediction in Inference). In every plot the mean is blue, the median green, the deviation
 * amber and prediction rose, and the normal model each sample is compared against is orange. Plots and
 * tables take their colors from this file only.
 */
export const PLOT_COLORS = {
  /** Observed data: histogram bars, ECDF, empirical PMF, box plot. */
  data: '#4b55c9',
  dataSoft: 'rgba(75,85,201,0.45)',
  /** Translucent fill behind data, e.g. the ECDF confidence band. */
  dataBand: 'rgba(75,85,201,0.16)',
  /** KDE: purple, close to the data color, because it is another estimate of the same distribution. */
  fit: '#8136b5',
  /** The normal model the data are compared against (normal density / CDF); kept for goodness-of-fit. */
  normal: '#b54a0b',
  /** Reference curves: the null distribution (Hypothesis), query marks (Probability). */
  reference: '#151d2b',
  referenceMuted: '#5d677b',
  /** Interval roles; the same role has the same color in every tab. */
  ciMean: '#1565c0',
  ciMedian: '#0b7a45',
  ciDeviation: '#9a5800',
  pi: '#b4235a',
  /** Hypothesis regions and markers. */
  reject: 'rgba(163,25,91,0.16)',
  rejectLine: '#a3195b',
  pValue: 'rgba(21,101,192,0.22)',
  outlier: '#b4235a',
  /** Observed test statistic (Hypothesis). */
  statistic: '#151d2b',
  /** Reference lines drawn over data: sample mean and median (same hues as their intervals). */
  mean: '#1565c0',
  median: '#0b7a45',
  /**
   * Joint confidence regions (Inference), over the relative-likelihood heatmap: the estimate sits where the
   * heatmap is brightest, so it is dark; the marginal box is dashed to set it apart from the region lines.
   */
  regionEstimate: '#151d2b',
  regionBox: '#ffffff',
  /** Part of a distribution selected by a query (Probability), and the rest of it. */
  highlight: '#4b55c9',
  highlightFill: 'rgba(75,85,201,0.24)',
  inactive: '#a9bbe9',
  hoverBg: '#ffffff',
  hoverBorder: '#68758d',
  grid: '#e4e8ef',
  axisText: '#434d61',
  text: '#151d2b',
} as const

/** Region line `index` of `count`, all white, fainter as the coverage rises. */
export function regionLineColor(index: number, count: number): string {
  const opacity = count > 1 ? 1 - (0.55 * index) / (count - 1) : 1
  return `rgba(255,255,255,${opacity.toFixed(2)})`
}

/**
 * Row tints for tables whose rows have a type (ResultTable), as Tailwind classes. Descriptive Statistics
 * tints by statistic type; Statistical Inference by interval kind, with the hues of its interval plots.
 */
export const TABLE_TINTS = {
  // Descriptive Statistics
  'Extremes': { row: 'bg-rose-50', text: 'text-rose-800', label: 'text-rose-700' },
  'Quantiles': { row: 'bg-purple-50', text: 'text-purple-800', label: 'text-purple-700' },
  'Central Tendency': { row: 'bg-blue-50', text: 'text-blue-800', label: 'text-blue-700' },
  'Dispersion': { row: 'bg-amber-50', text: 'text-amber-800', label: 'text-amber-700' },
  // Shape is the least-read group, so it gets the quiet warm grey.
  'Shape': { row: 'bg-stone-50', text: 'text-stone-800', label: 'text-stone-700' },
  // Statistical Inference
  'Prediction': { row: 'bg-rose-50', text: 'text-rose-800', label: 'text-rose-700' },
  'Mean': { row: 'bg-blue-50', text: 'text-blue-800', label: 'text-blue-700' },
  'Median': { row: 'bg-emerald-50', text: 'text-emerald-800', label: 'text-emerald-700' },
  'Deviation': { row: 'bg-amber-50', text: 'text-amber-800', label: 'text-amber-700' },
} as const satisfies Record<string, { row: string; text: string; label: string }>

/** Histogram bars of observed data, the same soft look in every Statistics tab so lines drawn over them stand out. */
export const HISTOGRAM_MARKER = { color: PLOT_COLORS.dataSoft } as const

export const PLOT_FONT = { color: PLOT_COLORS.text, size: 12 } as const

export const PLOT_AXIS = {
  gridcolor: PLOT_COLORS.grid,
  zeroline: false,
  color: PLOT_COLORS.axisText,
} as const

export const PLOT_CONFIG = { displayModeBar: false, responsive: true } as const

/** Base layout; pass overrides for height, margins, titles and axis specifics. */
export function baseLayout(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: PLOT_FONT,
    xaxis: { ...PLOT_AXIS },
    yaxis: { ...PLOT_AXIS },
    showlegend: false,
    hoverlabel: { bgcolor: PLOT_COLORS.hoverBg, bordercolor: PLOT_COLORS.hoverBorder, font: { color: PLOT_COLORS.text, size: 12 } },
    ...overrides,
  }
}
