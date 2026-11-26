import { useMemo, useCallback } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import type { DistResult, DistParams } from '../../../hooks/useDistribution'
import { DISTRIBUTIONS } from '../../../hooks/useDistribution'
import { queryIncludes, queryLabel, type DistQuery } from '../../../math/probabilityQuery'
import ExportMenu from '../../../components/ExportMenu'
import { ResultsHead } from '../../../components/lab'
import { Block, DataTable, Legend, Out, PlotFrame } from '../../hypothesis/ui/blocks'
import { QueryFx, DistFx } from './ProbFormula'
import StatusBanner from '../../../components/StatusBanner'
import { PLOT_AXIS, PLOT_COLORS, PLOT_CONFIG, baseLayout } from '../../../plot/theme'
import { downloadChartsPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'
import { downloadPDF } from '../../../utils/exportPDF'
import { exportFilename } from '../../../utils/exportFilename'
import { useChartRegistry } from '../../../hooks/useChartRegistry'
import { formatAll, formatNumber } from '../../../utils/formatNumber'

const Plot = createPlotlyComponent(Plotly)

const CHART_ORDER = ['distribution'] as const

interface CommonDistObservationProps {
  distParams: DistParams
  appliedParams: DistParams | null
  result: DistResult | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  /** Data tab → Display precision. */
  precision: number
}

const LAYOUT_BASE = baseLayout({
  autosize: true,
  margin: { l: 52, r: 20, t: 12, b: 48 },
  showlegend: false,
  bargap: 0.15,
})
const AXIS = PLOT_AXIS

function buildDiscreteChart(result: DistResult, query: DistQuery, precision: number) {
  const ks = result.ks ?? []
  const probs = result.probs ?? []
  return {
    traces: [{
      x: ks,
      y: probs,
      type: 'bar' as const,
      marker: { color: ks.map((k) => queryIncludes(query, k) ? PLOT_COLORS.highlight : PLOT_COLORS.inactive) },
      name: 'P(X = k)',
      customdata: formatAll(probs, precision),
      hovertemplate: 'k=%{x}<br>P(X=k)=%{customdata}<extra></extra>',
    }],
    layout: {
      ...LAYOUT_BASE,
      xaxis: { ...AXIS, title: { text: 'X (number of occurrences)' } },
      yaxis: { ...AXIS, title: { text: 'P(X = k)' } },
    },
  }
}

/** The x range whose area is P(query); null when the area is zero (P(X = x) of a continuous X). */
function shadedRange(query: DistQuery): [number, number] | null {
  if (query.kind === 'interval') return [query.lower, query.upper]
  switch (query.op) {
    case '<=': case '<': return [-Infinity, query.k]
    case '>=': case '>': return [query.k, Infinity]
    case '=': return null
  }
}

/** Density at x by linear interpolation on the plotted grid, so the shading starts exactly at x. */
function densityAt(xs: number[], ys: number[], x: number): number {
  const i = xs.findIndex((value) => value >= x)
  if (i <= 0) return i === 0 ? ys[0] : ys[ys.length - 1]
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
  return ys[i - 1] + t * (ys[i] - ys[i - 1])
}

function buildContinuousChart(result: DistResult, query: DistQuery, precision: number) {
  const xs = result.xs ?? []
  const ys = result.ys ?? []

  const shadeXs: number[] = []
  const shadeYs: number[] = []
  const range = shadedRange(query)
  if (range && xs.length > 0) {
    const from = Math.max(range[0], xs[0])
    const to = Math.min(range[1], xs[xs.length - 1])
    if (from <= to) {
      shadeXs.push(from); shadeYs.push(densityAt(xs, ys, from))
      xs.forEach((x, i) => { if (x > from && x < to) { shadeXs.push(x); shadeYs.push(ys[i]) } })
      shadeXs.push(to); shadeYs.push(densityAt(xs, ys, to))
    }
  }
  const marks = query.kind === 'interval' ? [query.lower, query.upper] : [query.k]
  const top = Math.max(0, ...ys.filter((y) => isFinite(y))) * 1.05

  return {
    traces: [
      ...(shadeXs.length > 0 ? [{
        x: shadeXs, y: shadeYs,
        type: 'scatter' as const,
        mode: 'none' as const,
        fill: 'tozeroy' as const,
        fillcolor: PLOT_COLORS.highlightFill,
        name: `${queryLabel(query)} = ${formatNumber(result.queryResult, precision)}`,
        showlegend: true,
        hoverinfo: 'skip' as const,
      }] : []),
      {
        x: xs, y: ys,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'PDF',
        line: { color: PLOT_COLORS.highlight, width: 2.5 },
      },
      ...marks.map((x) => ({
        x: [x, x],
        y: [0, top],
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `x = ${x}`,
        line: { color: PLOT_COLORS.reference, width: 1.5, dash: 'dash' as const },
      })),
    ],
    layout: {
      ...LAYOUT_BASE,
      xaxis: { ...AXIS, title: { text: 'x' } },
      yaxis: { ...AXIS, title: { text: 'Density' } },
    },
  }
}

export default function CommonDistObservation({ distParams, appliedParams, result, isLoading, error, onRetry, precision }: CommonDistObservationProps) {
  const displayParams = result?.provisional ? distParams : (appliedParams ?? distParams)
  const { distName, query, paramValues } = displayParams
  const probabilityLabel = queryLabel(query)
  const dist = DISTRIBUTIONS.find((d) => d.name === distName)
  const registry = useChartRegistry(CHART_ORDER)
  const baseName = `${distName}-distribution`

  const handleExportPNG = useCallback(() => {
    return downloadChartsPNG(registry.charts, exportFilename(`${baseName}-chart`, 'png', 'distribution'))
  }, [registry.charts, baseName])

  const handleExportCSV = useCallback(() => {
    if (!result) return
    if (dist?.type === 'discrete') {
      const { ks = [], probs = [], cumProbs = [] } = result
      const rows: (string | number | null)[][] = [['k', 'probability', 'cumulative_probability']]
      ks.forEach((k: number, i: number) => rows.push([k, probs[i] ?? null, cumProbs[i] ?? null]))
      downloadCSV(rows, exportFilename(`${baseName}-pmf`, 'csv', 'distribution'))
    } else {
      const { xs = [], ys = [], cdfYs = [] } = result
      const rows: (string | number | null)[][] = [['x', 'density', 'cumulative_probability']]
      xs.forEach((x: number, i: number) => rows.push([x, ys[i] ?? null, cdfYs[i] ?? null]))
      downloadCSV(rows, exportFilename(`${baseName}-pdf`, 'csv', 'distribution'))
    }
  }, [dist, result, baseName])

  const handleExportPDF = useCallback(async () => {
    if (!result) return
    const meanStr = typeof result.theorMean === 'number' ? formatNumber(result.theorMean, precision) : String(result.theorMean)
    const varStr  = typeof result.theorVariance === 'number' ? formatNumber(result.theorVariance, precision) : String(result.theorVariance)
    await downloadPDF({
      charts: registry.charts,
      title: `${distName} Distribution`,
      subtitle: `Query: ${probabilityLabel} = ${formatNumber(result.queryResult, precision)}`,
      stats: [
        { label: 'Distribution', value: distName },
        { label: 'Type',         value: dist?.type === 'discrete' ? 'Discrete' : 'Continuous' },
        { label: 'Mean E[X]',    value: meanStr },
        { label: 'Variance',     value: varStr },
        { label: probabilityLabel, value: formatNumber(result.queryResult, precision) },
        ...Object.entries(paramValues).map(([k, v]) => ({ label: k, value: String(v) })),
      ],
      filename: exportFilename(`${baseName}-report`, 'pdf', 'distribution'),
    })
  }, [distName, dist, probabilityLabel, result, paramValues, baseName, registry.charts, precision])

  const exportReady = !!result && !result.provisional && !isLoading && !!appliedParams && registry.ready
  const exportHandlers = exportReady ? { png: handleExportPNG, csv: handleExportCSV, pdf: handleExportPDF } : undefined

  const statCards = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Mean',
        value: typeof result.theorMean === 'number' ? formatNumber(result.theorMean, precision) : String(result.theorMean),
      },
      {
        label: 'Variance',
        value: typeof result.theorVariance === 'number' ? formatNumber(result.theorVariance, precision) : String(result.theorVariance),
      },
      {
        label: probabilityLabel,
        value: formatNumber(result.queryResult, precision),
        highlight: true,
      },
    ]
  }, [result, probabilityLabel, precision])

  const { traces, layout } = useMemo(() => {
    if (!dist || !result) return { traces: [], layout: LAYOUT_BASE }
    return dist.type === 'discrete'
      ? buildDiscreteChart(result, query, precision)
      : buildContinuousChart(result, query, precision)
  }, [dist, result, query, precision])

  const status = <StatusBanner isComputing={false} error={error} hasResult={!!result} onRetry={onRetry} />

  if (!result) return status

  const discrete = dist?.type === 'discrete'
  const paramText = Object.entries(paramValues).map(([key, value]) => `${key} = ${value}`).join(', ')
  const keyResult = `${probabilityLabel} = ${formatNumber(result.queryResult, precision)}`
  const moments = [
    { key: 'mean', label: 'Mean E[X]', value: statCards[0].value, part: 'mean' as const },
    { key: 'variance', label: 'Variance Var(X)', value: statCards[1].value, part: 'variance' as const },
  ]

  return (
    <Out updating={isLoading}>
      <ResultsHead title={`Common Distributions · ${distName}`} sub={`${distName} (${paramText})`}>
        <ExportMenu handlers={exportHandlers} ready={exportReady}
          disabledReason={result.provisional || isLoading ? 'Waiting for the authoritative backend result.' : 'Chart is still loading.'} />
      </ResultsHead>
      {status}

      <Block title="Result" fx={<QueryFx />}>
        <div className="hp-keyres">
          <span className="hp-keyres-label">Probability{result.provisional && <span title="Provisional: awaiting the backend result"> (preview ≈)</span>}</span>
          <span className="hp-keyres-num" aria-live="polite">{keyResult}</span>
        </div>
      </Block>

      <Block title="Mean and variance">
        <DataTable caption={`Of the ${distName} distribution`} visibleCaption
          columns={[{ key: 'quantity', label: 'Quantity' }, { key: 'value', label: 'Value', num: true }]}
          rows={moments.map((row) => ({ cells: { quantity: row.label, value: row.value }, fx: <DistFx name={distName} part={row.part} /> }))} />
      </Block>

      <Block title={discrete ? 'Probability mass' : 'Density'}>
        <PlotFrame label={`${discrete ? 'Probability mass function' : 'Probability density function'} of the ${distName} distribution. ${keyResult}.`}>
          {(height) => (
            <Plot
              data={traces}
              layout={{ ...layout, height } as object}
              style={{ width: '100%', height: '100%' }}
              config={PLOT_CONFIG}
              useResizeHandler
              onInitialized={registry.register('distribution', `${distName} distribution`)}
              onUpdate={registry.register('distribution', `${distName} distribution`)}
              onPurge={registry.unregister('distribution')}
            />
          )}
        </PlotFrame>
        <Legend items={discrete ? [
          { label: `In the query: ${probabilityLabel}`, swatch: { width: 16, height: 12, background: PLOT_COLORS.highlight } },
          { label: 'Not in the query', swatch: { width: 16, height: 12, background: PLOT_COLORS.inactive } },
        ] : [
          { label: 'Density', swatch: { width: 20, borderTop: `2.5px solid ${PLOT_COLORS.highlight}` } },
          { label: probabilityLabel, swatch: { width: 16, height: 12, background: PLOT_COLORS.highlightFill } },
          { label: `Chosen bound${query.kind === 'interval' ? 's' : ''}`, swatch: { width: 20, borderTop: `2px dashed ${PLOT_COLORS.reference}` } },
        ]} />
      </Block>
    </Out>
  )
}
