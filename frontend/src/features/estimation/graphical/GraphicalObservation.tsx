// features/estimation/graphical/GraphicalObservation.tsx
// Results of Graphical Analysis: the values behind the curves first (a table), then the plot (histogram or ECDF)
// with the requested overlays. Everything comes from the backend result.

import { useCallback, useMemo, type ReactNode } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import type { GraphicalResponse } from '../../../api/graphical'
import MathFormula from '../../../components/MathFormula'
import { downloadChartsPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'
import { downloadPDF } from '../../../utils/exportPDF'
import { exportFilename } from '../../../utils/exportFilename'
import { useChartRegistry } from '../../../hooks/useChartRegistry'
import { HISTOGRAM_MARKER, PLOT_AXIS, PLOT_COLORS, PLOT_CONFIG, baseLayout } from '../../../plot/theme'
import { formatCount, formatNumber, PRECISION_DEFAULT } from '../../../utils/formatNumber'
import ResultsFrame, { ResultsSection, Warnings } from '../shared/ResultsFrame'
import ResultsTable, { Legend, type LegendItem, type TableRow } from '../shared/ResultsTable'
import PlotBox from '../shared/PlotBox'
import { GraphFx, type GraphTopic } from './graphicalFormulas'

const Plot = createPlotlyComponent(Plotly)

const CHART_ORDER = ['graphical'] as const

// Colors come from the shared plot theme so every tab draws data the same way.
const C_MAIN = PLOT_COLORS.data
const C_KDE = PLOT_COLORS.fit
const C_BAND = PLOT_COLORS.dataBand
const C_NORMAL = PLOT_COLORS.normal

const AXIS = PLOT_AXIS
const CONFIG = PLOT_CONFIG

interface GraphicalObservationProps {
  result: GraphicalResponse | null
  column: string
  graphType: string
  isComputing: boolean
  error?: string | null
  onRetry?: () => void
  /** Backend warnings (and the estimator notice), shown under the table they are about. */
  warnings?: readonly string[]
  /** Decimals for tables, hovers and the PDF summary (docs/decisions.md, "Display precision"). */
  precision?: number
}

/** Pairs of formatted x and y for a line's hover, so it matches the tables. */
function pointLabels(x: number[], y: number[], precision: number) {
  return x.map((value, index) => [formatNumber(value, precision), formatNumber(y[index], precision)])
}

/** Bar centres and widths from histogram edges. */
function barsFromEdges(bins: number[], densities: number[]) {
  const x: number[] = []
  const width: number[] = []
  for (let i = 0; i < densities.length; i++) {
    x.push((bins[i] + bins[i + 1]) / 2)
    width.push(bins[i + 1] - bins[i])
  }
  return { x, width }
}

export default function GraphicalObservation({
  result, column, graphType, isComputing, error = null, onRetry, warnings = [], precision = PRECISION_DEFAULT,
}: GraphicalObservationProps) {
  const registry = useChartRegistry(CHART_ORDER)

  const traces = useMemo(() => {
    if (!result) return []
    const out: Record<string, unknown>[] = []

    if (result.histogram_data) {
      const { bins, densities, counts } = result.histogram_data
      const { x, width } = barsFromEdges(bins, densities)
      out.push({
        type: 'bar', x, y: densities, width,
        marker: HISTOGRAM_MARKER,
        name: 'Density',
        customdata: counts.map((count, index) => [
          formatNumber(bins[index], precision), formatNumber(bins[index + 1], precision), formatCount(count), formatNumber(densities[index], precision),
        ]),
        hovertemplate: 'Bin: %{customdata[0]} to %{customdata[1]}<br>Count: %{customdata[2]}<br>Density: %{customdata[3]}<extra></extra>',
      })
    }

    if (result.ecdf_data) {
      const { x, y, lower, upper } = result.ecdf_data
      if (lower && upper) {
        out.push({
          type: 'scatter', mode: 'lines', x, y: lower, line: { shape: 'hv', width: 0 },
          hoverinfo: 'skip', showlegend: false,
        })
        out.push({
          type: 'scatter', mode: 'lines', x, y: upper, line: { shape: 'hv', width: 0 },
          fill: 'tonexty', fillcolor: C_BAND, name: 'DKW band', hoverinfo: 'skip',
        })
      }
      out.push({
        type: 'scatter', mode: 'lines', x, y,
        line: { shape: 'hv', color: C_MAIN, width: 1.5 }, name: 'ECDF',
        customdata: pointLabels(x, y, precision),
        hovertemplate: '%{customdata[0]}<br>F(x) = %{customdata[1]}<extra></extra>',
      })
    }

    if (result.kde_curve) {
      out.push({
        type: 'scatter', mode: 'lines',
        x: result.kde_curve.x, y: result.kde_curve.y,
        line: { color: C_KDE, width: 2 }, name: 'KDE', hoverinfo: 'skip',
      })
    }

    if (result.normal_curve) {
      out.push({
        type: 'scatter', mode: 'lines',
        x: result.normal_curve.x, y: result.normal_curve.y,
        line: { color: C_NORMAL, width: 2.5, dash: 'longdash' },
        name: graphType === 'ECDF' ? 'Normal CDF' : 'Normal density',
        customdata: pointLabels(result.normal_curve.x, result.normal_curve.y, precision),
        hovertemplate: '%{customdata[0]}<br>%{customdata[1]}<extra></extra>',
      })
    }

    return out
  }, [result, graphType, precision])

  const layoutFor = useCallback((height: number) => {
    const yTitle = graphType === 'ECDF' ? 'ECDF' : 'Density'
    return baseLayout({
      autosize: true,
      height,
      margin: { l: 56, r: 20, t: 12, b: 44 },
      // Touching histogram bars.
      bargap: 0.02,
      // automargin makes room for the axis titles; a plain decimal format keeps small densities as 0.0002, not 200µ.
      xaxis: { ...AXIS, title: { text: column, standoff: 6 }, automargin: true },
      yaxis: {
        ...AXIS,
        title: { text: yTitle, standoff: 6 },
        automargin: true,
        ...(graphType === 'ECDF' ? { range: [0, 1.05] } : { tickformat: '.6~f' }),
      },
      // The key under the plot (Legend) names every curve, so the plot draws none.
      showlegend: false,
    })
  }, [column, graphType])

  // ── Exports ───────────────────────────────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    return downloadChartsPNG(registry.charts, exportFilename(`graphical-${column}-${graphType}`, 'png', 'graphical-analysis'))
  }, [column, graphType, registry.charts])

  const handleExportCSV = useCallback(() => {
    if (!result) return
    const rows: (string | number)[][] = []
    if (result.histogram_data) {
      rows.push(['bin_low', 'bin_high', 'count', 'density'])
      const { bins, counts, densities } = result.histogram_data
      counts.forEach((c, i) => rows.push([bins[i], bins[i + 1], c, densities[i]]))
    } else if (result.ecdf_data) {
      const { x, y, lower, upper } = result.ecdf_data
      rows.push(['x', 'cumulative_probability', 'lower_band', 'upper_band'])
      x.forEach((v, i) => rows.push([v, y[i], lower?.[i] ?? '', upper?.[i] ?? '']))
    }
    downloadCSV(rows, exportFilename(`graphical-${column}-${graphType}`, 'csv', 'graphical-analysis'))
  }, [result, column, graphType])

  const handleExportPDF = useCallback(async () => {
    const stats = [
      { label: 'n', value: formatCount(result?.summary.n) },
      { label: 'Unique values', value: formatCount(result?.summary.n_unique) },
    ]
    if (result?.point_estimates?.mu != null) {
      stats.push({ label: 'μ̂', value: formatNumber(result.point_estimates.mu, precision) })
    }
    if (result?.point_estimates?.sigma != null) {
      stats.push({ label: 'σ̂', value: formatNumber(result.point_estimates.sigma, precision) })
    }
    await downloadPDF({
      charts: registry.charts,
      title: `Graphical Analysis — ${column}`,
      subtitle: graphType,
      stats,
      filename: exportFilename(`graphical-${column}-${graphType}-report`, 'pdf', 'graphical-analysis'),
    })
  }, [result, column, graphType, registry.charts, precision])

  const exportReady = !!result && !isComputing && registry.ready

  // ── Values behind the curves (table first) ───────────────────────────────
  const ecdf = graphType === 'ECDF'
  const rows: TableRow[] = []
  if (result) {
    const sym = (tex: string, name: string) => <><MathFormula inline tex={tex} /> <span className="plain">{name}</span></>
    const row = (key: string, q: string, label: ReactNode, value: number | null | undefined, topic: GraphTopic, name: string) =>
      rows.push({ key, q, cells: { quantity: label, value: formatNumber(value, precision) }, fx: <GraphFx topic={topic} ecdf={ecdf} name={name} /> })
    if (!ecdf && result.kde_curve) {
      row('h', 'q-kde', sym('h', 'Bandwidth h used'), result.kde_curve.bandwidth, 'kde', 'KDE bandwidth h')
      row('hs', 'q-kde', sym(String.raw`h_{\text{Scott}}`, 'Scott’s rule bandwidth'), result.kde_curve.default_bandwidth, 'scott', 'Scott’s rule bandwidth')
    }
    if (result.normal_curve || result.point_estimates?.mu != null || result.point_estimates?.sigma != null) {
      row('mu', 'q-normal', sym(String.raw`\hat{\mu}`, 'Mean used by the normal model'), result.point_estimates?.mu, 'normal', 'normal model mean')
      row('sigma', 'q-normal', sym(String.raw`\hat{\sigma}`, 'Standard deviation used by the normal model'), result.point_estimates?.sigma, 'normal', 'normal model standard deviation')
    }
    if (ecdf && result.ecdf_data?.lower && result.alpha != null) {
      row('alpha', 'q-data', sym(String.raw`\alpha`, 'Significance level α'), result.alpha, 'band', 'significance level')
      row('eps', 'q-data', sym(String.raw`\varepsilon`, 'Half-width of the band'), result.ecdf_data.epsilon, 'band', 'band half-width epsilon')
    }
  }

  const legend: LegendItem[] = ecdf
    ? [{ label: 'ECDF (step line)', kind: 'solid', color: C_MAIN }]
    : [{ label: 'Histogram (density)', kind: 'area', color: C_MAIN }]
  if (result?.kde_curve) legend.push({ label: 'KDE', kind: 'solid', color: C_KDE })
  if (result?.ecdf_data?.lower) legend.push({ label: 'Confidence band', kind: 'area', color: C_MAIN })
  if (result?.normal_curve) legend.push({ label: 'Normal model', kind: 'dashed', color: C_NORMAL })

  return (
    <ResultsFrame title={`Graphical Analysis · ${column}`} n={result?.summary.n}
      updating={isComputing} error={error} onRetry={onRetry}
      exports={exportReady ? { png: handleExportPNG, csv: handleExportCSV, pdf: handleExportPDF } : undefined}
      exportReady={exportReady} exportReason={isComputing ? 'Waiting for the updated result.' : 'Chart is still loading.'}>
      {!result ? (isComputing ? <p className="est-note">Computing the plot…</p> : null) : (
        <>
          {rows.length > 0 && (
            <ResultsSection title="Values">
              <ResultsTable caption="Values behind the curves" columns={[
                { key: 'quantity', label: 'Quantity' }, { key: 'value', label: 'Value', num: true },
              ]} rows={rows} />
              <Warnings items={warnings} />
            </ResultsSection>
          )}
          <ResultsSection title={ecdf ? 'ECDF' : 'Histogram'}>
            {rows.length === 0 && <Warnings items={warnings} />}
            <PlotBox>
              {(height) => (
                <Plot
                  data={traces}
                  layout={layoutFor(height)}
                  config={CONFIG}
                  useResizeHandler
                  style={{ width: '100%', height }}
                  onInitialized={registry.register('graphical', `${graphType} for ${column}`)}
                  onUpdate={registry.register('graphical', `${graphType} for ${column}`)}
                  onPurge={registry.unregister('graphical')}
                />
              )}
            </PlotBox>
            <Legend items={legend} />
            {result.histogram_data && (
              <p className="est-note">Bar area represents proportion; height shows density. Hover a bar for its bin bounds and observation count.</p>
            )}
            {result.histogram_data?.unit_width && (
              <p className="est-note">Every value is a whole number with repeats, so the bins are automatic: one bar of width 1 per whole number.</p>
            )}
          </ResultsSection>
        </>
      )}
    </ResultsFrame>
  )
}
