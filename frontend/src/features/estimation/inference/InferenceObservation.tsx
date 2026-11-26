import ReactPlotly from 'react-plotly.js'
import MathFormula from '../../../components/MathFormula'
import type { ConfidenceRegionsResponse, IntervalsResponse } from '../../../api/inference'
import { useMemo } from 'react'
import type { InferenceState } from './useInferenceTabState'
import { coveragePercent, formatInferenceNumber, intervalRange, parseIntervalRows, pointEstimate, quantityLabel, rowLabel, type IntervalRow } from './inferencePresentation'
import { HISTOGRAM_MARKER, PLOT_AXIS, PLOT_COLORS, PLOT_CONFIG, baseLayout, regionLineColor } from '../../../plot/theme'
import ResultsFrame, { ResultsSection, Warnings } from '../shared/ResultsFrame'
import ResultsTable, { Legend, type LegendItem, type TableRow } from '../shared/ResultsTable'
import PlotBox from '../shared/PlotBox'
import { IntervalFx, RegionFx } from './IntervalFx'
import { useChartRegistry } from '../../../hooks/useChartRegistry'
import { downloadChartsPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'
import { downloadPDF } from '../../../utils/exportPDF'
import { exportFilename } from '../../../utils/exportFilename'
import { formatAll, formatNumber } from '../../../utils/formatNumber'

const AXIS = { ...PLOT_AXIS, fixedrange: true }
const BASE_LAYOUT = baseLayout({ autosize: true, dragmode: false })
const CONFIG = PLOT_CONFIG
/** The same quantity has the same color in every tab (plot/theme.ts). */
const colorOfRow = (row: IntervalRow) => {
  const label = quantityLabel(row.Statistic)
  return label === 'Mean' ? PLOT_COLORS.ciMean : label === 'Median' ? PLOT_COLORS.ciMedian : label === 'Deviation' ? PLOT_COLORS.ciDeviation : PLOT_COLORS.pi
}
/** Where to write a region's coverage: its top edge above the estimated mean (z rows run over σ, columns over μ). */
function regionLabelPoint(region: ConfidenceRegionsResponse, level: number): { x: number; y: number } | null {
  const column = region.mu_grid.reduce((best, mu, index) => Math.abs(mu - region.mu_hat) < Math.abs(region.mu_grid[best] - region.mu_hat) ? index : best, 0)
  for (let row = region.sigma_grid.length - 1; row >= 0; row -= 1) {
    if (region.z_matrix[row][column] >= level) return { x: region.mu_grid[column], y: region.sigma_grid[row] }
  }
  return null
}

function bracketTraces(rows: IntervalRow[], estimates: IntervalsResponse['point_estimates'], colorOf: (row: IntervalRow) => string, precision: number): any[] {
  return rows.flatMap((row, index) => {
    const color = colorOf(row)
    const estimate = pointEstimate(row.Statistic, estimates)
    return [
      { x: [row.Lower, row.Upper], y: [index, index], type: 'scatter', mode: 'lines+markers', line: { color, width: 3 }, marker: { color, size: 5 }, name: rowLabel(row), customdata: formatAll([row.Lower, row.Upper], precision), hovertemplate: '%{customdata}<extra></extra>' },
      ...(estimate !== null ? [{ x: [estimate], y: [index], type: 'scatter', mode: 'markers', marker: { color, size: 9, symbol: 'diamond' }, name: 'Sample estimate', customdata: [formatNumber(estimate, precision)], hovertemplate: 'Sample estimate: %{customdata}<extra></extra>' }] : []),
    ]
  })
}
function IntervalPlot({ rows, result, range, colorOf, variable, precision, onReady, onPurge }: {
  rows: IntervalRow[]; result: IntervalsResponse; range?: [number, number]; colorOf: (row: IntervalRow) => string; variable: string; precision: number
  onReady: (figure: unknown, element: HTMLElement) => void; onPurge: () => void
}) {
  const height = Math.max(145, rows.length * 38 + 74)
  return <>
    <ReactPlotly data={bracketTraces(rows, result.point_estimates, colorOf, precision)} layout={{
      ...BASE_LAYOUT, height, margin: { l: 90, r: 24, b: 48, t: 10 },
      xaxis: { ...AXIS, range, title: { text: variable, standoff: 8 } },
      // automargin widens the left margin to fit long labels such as "Mean – bootstrap".
      yaxis: { ...AXIS, automargin: true, tickvals: rows.map((_, index) => index), ticktext: rows.map(row => rowLabel(row)), range: [rows.length - 0.4, -0.6] },
    }} useResizeHandler style={{ width: '100%', height }} config={CONFIG}
      onInitialized={onReady} onUpdate={onReady} onPurge={onPurge} />
  </>
}
// The class names let estimation.css thin the table as its column narrows (as the approved prototype does):
// Method moves under the statistic, then Interval too, and Lower and Upper stack in one column.
const INTERVAL_COLUMNS = [
  { key: 'interval', label: 'Interval', className: 'col-interval' },
  { key: 'statistic', label: 'Statistic', className: 'col-stat' },
  { key: 'method', label: 'Method', className: 'col-method' },
  { key: 'estimate', label: 'Estimate', num: true },
  { key: 'lower', label: 'Lower', num: true, className: 'col-lower' },
  { key: 'upper', label: 'Upper', num: true, className: 'col-upper' },
  { key: 'lu', label: <>Lower /<br />Upper</>, num: true, className: 'col-lu' },
] as const
const CI_GROUPS = ['Mean', 'Median', 'Deviation'] as const
const QUANTITY_CLASS: Record<string, string> = { Mean: 'q-mean', Median: 'q-median', Deviation: 'q-deviation' }

/** Marks a plot whose x-axis is not the data axis shared by the plots above it. */
const DIFFERENT_SCALE = <span className="est-tag">Different scale</span>

/** What a prediction interval is based on, in the left panel's words. */
function predictionBasis(interval: IntervalRow): string {
  const basis = quantityLabel(interval.Statistic)
  return basis === 'Bootstrap' ? 'Using bootstrap' : 'Based on the ' + (basis === 'IQR' ? 'IQR' : basis.toLowerCase())
}

/**
 * One row per interval, in the order of the plots below: prediction, then mean, median and deviation. Each row is
 * coloured by its quantity, with the same hues as the interval plots, and carries the ƒ of its own formula.
 */
function intervalTableRows(ciRows: IntervalRow[], piRows: IntervalRow[], state: InferenceState): TableRow[] {
  const sigmaEstimator = state.appliedConfig?.sigma_estimator ?? 'Deviation (1 ddof)'
  const row = (kind: 'confidence' | 'prediction', q: string, statistic: string, interval: IntervalRow, source: IntervalsResponse, index: number): TableRow => {
    const estimate = pointEstimate(interval.Statistic, source.point_estimates)
    return {
      key: kind + '-' + index,
      q,
      cells: {
        interval: kind === 'prediction' ? 'Prediction' : 'Confidence',
        statistic: <>
          <span className="lu-sub lu-sub-int">{kind === 'prediction' ? 'Prediction' : 'Confidence'}</span>
          {statistic}
          <span className="lu-sub lu-sub-method">{interval.Method}</span>
        </>,
        method: interval.Method,
        estimate: estimate == null ? '—' : formatInferenceNumber(estimate, state.precision),
        lower: formatInferenceNumber(interval.Lower, state.precision),
        upper: formatInferenceNumber(interval.Upper, state.precision),
        lu: <><span className="lu">{formatInferenceNumber(interval.Lower, state.precision)}</span><span className="lu">{formatInferenceNumber(interval.Upper, state.precision)}</span></>,
      },
      fx: <IntervalFx kind={kind} row={interval} sigmaEstimator={sigmaEstimator} name={(kind === 'prediction' ? 'prediction interval, ' : 'confidence interval, ') + statistic.toLowerCase()} />,
    }
  }
  return [
    ...piRows.map((interval, index) => row('prediction', 'q-prediction', predictionBasis(interval), interval, state.piResult!, index)),
    ...CI_GROUPS.flatMap(quantity => ciRows.filter(interval => quantityLabel(interval.Statistic) === quantity)
      .map((interval) => row('confidence', QUANTITY_CLASS[quantity], rowLabel(interval), interval, state.ciResult!, ciRows.indexOf(interval)))),
  ]
}

/** The key under an interval plot: one line per quantity drawn in it, and the diamond for the sample estimate. */
function intervalLegend(rows: IntervalRow[], colorOf: (row: IntervalRow) => string, estimates: boolean): LegendItem[] {
  const seen = new Set<string>()
  const items: LegendItem[] = []
  rows.forEach((row) => {
    const label = quantityLabel(row.Statistic)
    // Every prediction row has one colour and one key line, however many bases (mean, median, IQR) it has.
    const shown = label === 'Bootstrap' || label === 'IQR' || colorOf(row) === PLOT_COLORS.pi ? 'Prediction interval' : label + ' (confidence)'
    if (seen.has(shown)) return
    seen.add(shown)
    items.push({ label: shown, kind: 'solid', color: colorOf(row) })
  })
  if (estimates) items.push({ label: 'Sample estimate', kind: 'dot', color: PLOT_COLORS.text })
  return items
}

export default function InferenceObservation({ state }: { state: InferenceState }) {
  const ciRows = parseIntervalRows(state.ciResult)
  const piRows = parseIntervalRows(state.piResult)
  const region = state.regionResult
  const variable = state.appliedConfig?.column ?? ''
  const result = state.ciResult ?? state.piResult
  const hasResult = !!(result || region)
  const warnings = state.estimatorError ? [state.estimatorError] : []
  const chartOrder = useMemo(() => {
    if (region) return ['region']
    if (!result) return []
    const order: string[] = []
    if ((result.histogram?.binEdges?.length ?? 0) > 1) order.push('observed')
    if (piRows.length) order.push('prediction')
    if (ciRows.some((row) => quantityLabel(row.Statistic) !== 'Deviation')) order.push('location')
    if (ciRows.some((row) => quantityLabel(row.Statistic) === 'Deviation')) order.push('deviation')
    return order
  }, [region, result, ciRows, piRows])
  const registry = useChartRegistry(chartOrder)
  let content
  if (region) {
    const data: any[] = [{
      z: region.z_matrix, x: region.mu_grid, y: region.sigma_grid, type: 'heatmap', colorscale: 'Viridis',
      colorbar: { title: { text: 'Relative likelihood', side: 'right' }, thickness: 12, x: 1.02 },
      text: region.z_matrix.map((zRow, row) => zRow.map((z, column) =>
        `Mean ${formatNumber(region.mu_grid[column], state.precision)}<br>Deviation ${formatNumber(region.sigma_grid[row], state.precision)}<br>Relative likelihood ${formatNumber(z, state.precision)}`)),
      hovertemplate: '%{text}<extra></extra>',
    }]
    region.levels.forEach((level, index) => data.push({
      z: region.z_matrix, x: region.mu_grid, y: region.sigma_grid, type: 'contour',
      // 'none' draws the line in line.color; 'lines' would take it from a color scale instead.
      contours: { start: level, end: level, size: 1, coloring: 'none' },
      line: { color: regionLineColor(index, region.levels.length), width: 2 }, name: coveragePercent(region.probs[index]) + ' region', showlegend: true, showscale: false, hoverinfo: 'skip',
    }))
    data.push({ x: [region.mu_hat], y: [region.sigma_hat], mode: 'markers', type: 'scatter', name: 'Estimated mean and deviation', showlegend: true, marker: { color: PLOT_COLORS.regionEstimate, size: 11, symbol: 'x' }, customdata: [[formatNumber(region.mu_hat, state.precision), formatNumber(region.sigma_hat, state.precision)]], hovertemplate: 'Mean %{customdata[0]}<br>Deviation %{customdata[1]}<extra></extra>' })
    if (state.appliedConfig?.add_ci_box && region.mu_ci && region.sigma_ci) data.push({
      x: [region.mu_ci[0], region.mu_ci[1], region.mu_ci[1], region.mu_ci[0], region.mu_ci[0]], y: [region.sigma_ci[0], region.sigma_ci[0], region.sigma_ci[1], region.sigma_ci[1], region.sigma_ci[0]],
      mode: 'lines', type: 'scatter', name: 'Separate marginal intervals', showlegend: true, line: { color: PLOT_COLORS.regionBox, dash: 'dash', width: 2 }, hoverinfo: 'skip',
    })
    const regionLabels = region.levels.flatMap((level, index) => {
      const point = regionLabelPoint(region, level)
      return point ? [{ ...point, text: coveragePercent(region.probs[index]), showarrow: false, yshift: 9, font: { color: regionLineColor(index, region.levels.length), size: 12 } }] : []
    })
    const withBox = !!(state.appliedConfig?.add_ci_box && region.mu_ci && region.sigma_ci)
    const cutoffs = region.probs.map((p, index) => ({ p, level: region.levels[index] })).sort((x, y) => x.p - y.p)
    const fmt = (value: number) => formatInferenceNumber(value, state.precision)
    const regionRows: TableRow[] = [
      { key: 'mu', q: 'q-mean', cells: { quantity: <><MathFormula inline tex={String.raw`\hat{\mu}`} /> <span className="plain">Estimated mean</span></>, value: fmt(region.mu_hat) }, fx: <RegionFx withBox={withBox} /> },
      { key: 'sigma', q: 'q-deviation', cells: { quantity: <><MathFormula inline tex={String.raw`\hat{\sigma}`} /> <span className="plain">Estimated deviation</span></>, value: fmt(region.sigma_hat) }, fx: <RegionFx withBox={withBox} /> },
      ...cutoffs.map(({ p, level }) => ({ key: 'cut-' + p, cells: { quantity: <span className="plain">Cut-off for {coveragePercent(p)} coverage</span>, value: fmt(level) }, fx: <RegionFx withBox={withBox} /> })),
      ...(withBox ? [
        { key: 'mu-box', cells: { quantity: <span className="plain">Mean interval (box)</span>, value: region.mu_ci!.map(fmt).join(' to ') }, fx: <RegionFx withBox /> },
        { key: 'sigma-box', cells: { quantity: <span className="plain">Deviation interval (box)</span>, value: region.sigma_ci!.map(fmt).join(' to ') }, fx: <RegionFx withBox /> },
      ] : []),
    ]
    content = <>
      <ResultsSection title="Values">
        <ResultsTable caption="Estimates and region cut-offs" columns={[{ key: 'quantity', label: 'Quantity' }, { key: 'value', label: 'Value', num: true }]} rows={regionRows} />
        <Warnings items={warnings} />
      </ResultsSection>
      <ResultsSection title="Joint confidence regions">
        <PlotBox label={'Joint confidence regions for ' + variable + '. Estimates and coverage levels are in the table above.'}>
          {(height) => (
            <ReactPlotly data={data} layout={{ ...BASE_LAYOUT, height: height + 90, margin: { l: 62, r: 80, b: 130, t: 20 }, xaxis: { ...AXIS, title: { text: 'Mean (μ)', standoff: 8 } }, yaxis: { ...AXIS, title: { text: 'Deviation (σ)', standoff: 8 } }, annotations: regionLabels, showlegend: true, legend: { x: 0, y: -0.25, orientation: 'h', font: { size: 12 } } }} useResizeHandler style={{ width: '100%', height: height + 90 }} config={CONFIG}
              onInitialized={registry.register('region', 'Joint confidence regions')}
              onUpdate={registry.register('region', 'Joint confidence regions')}
              onPurge={registry.unregister('region')} />
          )}
        </PlotBox>
      </ResultsSection>
    </>
  } else if (result) {
    const edges = result.histogram?.binEdges ?? []
    const centers = edges.slice(0, -1).map((lower, index) => (lower + edges[index + 1]) / 2)
    const locationRows = ciRows.filter(row => quantityLabel(row.Statistic) !== 'Deviation')
    const deviationRows = ciRows.filter(row => quantityLabel(row.Statistic) === 'Deviation')
    const commonRange = intervalRange([...edges, ...locationRows.flatMap(row => [row.Lower, row.Upper]), ...piRows.flatMap(row => [row.Lower, row.Upper])])
    const ciRange = intervalRange(locationRows.flatMap(row => [row.Lower, row.Upper]))
    const tableRows = intervalTableRows(ciRows, piRows, state)
    const alpha = state.appliedConfig?.alpha
    const zoom = state.draft.zoomCI
    content = <>
      {tableRows.length > 0 && <ResultsSection title="Intervals">
        <ResultsTable caption={variable + ', n = ' + (result.n ?? 0).toLocaleString('en-US') + (alpha != null ? ', α = ' + formatInferenceNumber(alpha, state.precision) + ' (' + coveragePercent(1 - alpha) + ' coverage)' : '')}
          columns={INTERVAL_COLUMNS} rows={tableRows} />
        <Warnings items={warnings} />
      </ResultsSection>}
      {centers.length > 0 && <ResultsSection title="Observed values">
        <PlotBox>
          {(height) => <ReactPlotly data={[{ x: centers, y: result.histogram.counts, type: 'bar', marker: HISTOGRAM_MARKER, width: edges[1] - edges[0], hovertemplate: 'Count %{y}<extra></extra>' }]} layout={{ ...BASE_LAYOUT, height: Math.min(height, 260), margin: { l: 90, r: 24, b: 48, t: 12 }, xaxis: { ...AXIS, range: commonRange, title: { text: variable, standoff: 8 } }, yaxis: { ...AXIS, title: { text: 'Count' } } }} useResizeHandler style={{ width: '100%', height: Math.min(height, 260) }} config={CONFIG}
            onInitialized={registry.register('observed', 'Observed values')}
            onUpdate={registry.register('observed', 'Observed values')}
            onPurge={registry.unregister('observed')} />}
        </PlotBox>
        <Legend items={[{ label: 'Histogram of the data', kind: 'area', color: PLOT_COLORS.data }]} />
      </ResultsSection>}
      {piRows.length > 0 && <ResultsSection title="Prediction intervals" note="One future observation · same x-axis scale as observed values">
        <div className="est-plot"><IntervalPlot rows={piRows} result={state.piResult!} range={commonRange} colorOf={() => PLOT_COLORS.pi} variable={variable} precision={state.precision}
          onReady={registry.register('prediction', 'Prediction intervals')} onPurge={registry.unregister('prediction')} /></div>
        <Legend items={intervalLegend(piRows, () => PLOT_COLORS.pi, true)} />
      </ResultsSection>}
      {locationRows.length > 0 && <ResultsSection title="Mean and median confidence intervals"
        tag={zoom ? DIFFERENT_SCALE : undefined}
        note={zoom ? 'Zoomed to confidence intervals — different x-axis scale from observed values and predictions.' : 'Same x-axis scale as observed values and prediction intervals.'}
        actions={<button type="button" aria-pressed={zoom} onClick={() => state.setDraft({ zoomCI: !zoom })} className="lab-btn">{zoom ? 'Use common scale' : 'Zoom to intervals'}</button>}>
        <div className="est-plot"><IntervalPlot rows={locationRows} result={state.ciResult!} range={zoom ? ciRange : commonRange} colorOf={colorOfRow} variable={variable} precision={state.precision}
          onReady={registry.register('location', 'Mean and median confidence intervals')} onPurge={registry.unregister('location')} /></div>
        <Legend items={intervalLegend(locationRows, colorOfRow, true)} />
      </ResultsSection>}
      {deviationRows.length > 0 && <ResultsSection title="Deviation confidence intervals" tag={DIFFERENT_SCALE}
        note="Measures the spread of the data, not its position; this axis is not the one above.">
        <div className="est-plot"><IntervalPlot rows={deviationRows} result={state.ciResult!} colorOf={colorOfRow} variable={'Deviation σ of ' + variable + ' (spread, in data units)'} precision={state.precision}
          onReady={registry.register('deviation', 'Deviation confidence intervals')} onPurge={registry.unregister('deviation')} /></div>
        <Legend items={intervalLegend(deviationRows, colorOfRow, true)} />
      </ResultsSection>}
    </>
  }
  const baseName = `inference-${variable || 'analysis'}`
  const exportCSV = () => {
    if (region) {
      const rows: (string | number)[][] = [
        ['# mu_hat', region.mu_hat, ''], ['# sigma_hat', region.sigma_hat, ''],
        ['# coverage_probabilities', region.probs.join('; '), ''],
        ['mu', 'sigma', 'relative_likelihood'],
      ]
      region.mu_grid.forEach((mu, xIndex) => region.sigma_grid.forEach((sigma, yIndex) => {
        rows.push([mu, sigma, region.z_matrix[yIndex]?.[xIndex] ?? ''])
      }))
      downloadCSV(rows, exportFilename(`${baseName}-confidence-region`, 'csv', 'inference'))
      return
    }
    const rows: (string | number)[][] = [[
      'record_type', 'result_type', 'statistic', 'method', 'lower', 'upper', 'point_estimate', 'status', 'message',
    ]]
    ;[
      ...ciRows.map((row) => ({ row, type: 'confidence', source: state.ciResult! })),
      ...piRows.map((row) => ({ row, type: 'prediction', source: state.piResult! })),
    ].forEach(({ row, type, source }) => rows.push([
      'interval', type, quantityLabel(row.Statistic), row.Method, row.Lower ?? '', row.Upper ?? '',
      pointEstimate(row.Statistic, source.point_estimates) ?? '', 'complete', '',
    ]))
    if (state.partialResult) rows.push(['omitted', '', '', '', '', '', '', 'omitted', state.error ?? 'One requested section failed.'])
    downloadCSV(rows, exportFilename(`${baseName}-intervals`, 'csv', 'inference'))
  }
  const exportPNG = () => downloadChartsPNG(registry.charts, exportFilename(`${baseName}-charts`, 'png', 'inference'))
  const exportPDF = async () => {
    const intervalRows = [...ciRows.map((row) => ['Confidence', quantityLabel(row.Statistic), row.Method, row.Lower, row.Upper]),
      ...piRows.map((row) => ['Prediction', quantityLabel(row.Statistic), row.Method, row.Lower, row.Upper])]
    await downloadPDF({
      title: `Statistical Inference - ${variable}`,
      subtitle: state.appliedConfig?.estimationType,
      charts: registry.charts,
      stats: [
        { label: 'Variable', value: variable },
        { label: 'Alpha', value: String(state.appliedConfig?.alpha ?? '') },
        ...(state.partialResult ? [{ label: 'Partial result', value: state.error ?? 'One requested section failed.' }] : []),
      ],
      tables: intervalRows.length ? [{ title: 'Intervals', columns: ['Type', 'Statistic', 'Method', 'Lower', 'Upper'], rows: intervalRows }] : [],
      filename: exportFilename(`${baseName}-report`, 'pdf', 'inference'),
    })
  }
  const exportReady = hasResult && !state.isComputing && registry.ready

  return (
    <ResultsFrame title={'Statistical Inference · ' + (variable || 'results')} n={result?.n}
      updating={state.isComputing} error={state.error} partialNotice={state.partialResult ? 'Partial result: only the successful intervals are shown.' : undefined}
      onRetry={state.handleRetry}
      exports={exportReady ? { png: exportPNG, csv: exportCSV, pdf: exportPDF } : undefined}
      exportReady={exportReady} exportReason={state.isComputing ? 'Waiting for the applied result.' : 'Charts are still loading.'}>
      {hasResult ? content : (state.isComputing ? <p className="est-note">Computing the intervals…</p> : null)}
    </ResultsFrame>
  )
}
