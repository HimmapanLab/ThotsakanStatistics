// features/estimation/descriptive/DescriptiveObservation.tsx
// Results of Descriptive Statistics: the statistics table first, then the histogram and box plot. Everything
// comes from the backend result; rounding happens here, in display precision only.

import { useCallback } from 'react'
import Plot from 'react-plotly.js'
import { type DescriptiveResult, type StatRow } from '../../../api/descriptive'
import type { DescriptiveConfig } from './useDescriptiveTabState'
import { estimatorTags } from './descriptiveOptions'
import { StatFx } from './descriptiveFormulas'
import ResultsFrame, { ResultsSection, Warnings } from '../shared/ResultsFrame'
import ResultsTable, { Legend, type TableRow } from '../shared/ResultsTable'
import PlotBox from '../shared/PlotBox'
import { HISTOGRAM_MARKER, PLOT_AXIS, PLOT_COLORS, PLOT_CONFIG, baseLayout } from '../../../plot/theme'
import { downloadCSV } from '../../../utils/exportCSV'
import { downloadChartsPNG } from '../../../utils/exportPNG'
import { downloadPDF } from '../../../utils/exportPDF'
import { exportFilename } from '../../../utils/exportFilename'
import { useChartRegistry } from '../../../hooks/useChartRegistry'
import { formatAll, formatNumber } from '../../../utils/formatNumber'

const CHART_ORDER = ['descriptive'] as const

/** Where the box plot sits, in paper coordinates (the histogram fills the space below). */
const BOX = { histTop: 0.73, bottom: 0.78, low: 0.81, capLow: 0.85, middle: 0.89, capHigh: 0.93, high: 0.97 } as const

// ─── Statistics Table ─────────────────────────────────────────────────────────

const TAG_TITLE = {
  Unbiased: 'Unbiased under normality',
  Consistent: 'Consistent: converges to the true value as n grows',
} as const
const quantityClass = (id?: string) => id === 'mean' ? 'q-mean' : id === 'median' ? 'q-median' : undefined

function Tags({ tags }: { tags: readonly ('Unbiased' | 'Consistent')[] }) {
  return <>{tags.map((tag) => (
    <span key={tag} className={`est-tag est-tag-${tag.toLowerCase()}`} data-tag="correction" title={TAG_TITLE[tag]}>{tag}</span>
  ))}</>
}

function StatsTable({ rows, showConsistencyCorr, precision, n }: {
  rows: StatRow[]; showConsistencyCorr: boolean; precision: number; n: number
}) {
  const fmt = (v: number | null) => formatNumber(v, precision)
  const columns = [
    { key: 'measure', label: 'Statistic' },
    { key: 'value', label: 'Value', num: true },
    ...(showConsistencyCorr ? [{ key: 'corr', label: 'Normal-corrected', num: true }] : []),
  ]
  const tableRows: TableRow[] = rows.map((row, index) => {
    const corrected = showConsistencyCorr && row.consistencyCorr != null
    // c₄(n) is a fixed constant of the method, shown at 6 decimals whatever the display precision.
    const c4 = row.statId === 'std_dev_1' && corrected && row.value != null && row.consistencyCorr !== 0
      ? `c₄(n = ${n}) = ${(row.value / row.consistencyCorr!).toFixed(6)}` : undefined
    return {
      key: `${row.statId ?? row.measure}-${index}`,
      group: row.category,
      q: quantityClass(row.statId),
      cells: {
        measure: (
          <>
            {row.measure}
            <Tags tags={estimatorTags(row, false)} />
          </>
        ),
        value: fmt(row.value),
        corr: (
          <span className="est-cellstack">
            <span>{row.consistencyCorr != null ? <Tags tags={estimatorTags(row, true)} /> : null}</span>
            <span className="val">{fmt(row.consistencyCorr)}</span>
          </span>
        ),
      },
      fx: row.statId ? <StatFx id={row.statId} corrected={corrected} note={c4} /> : undefined,
    }
  })
  return <ResultsTable caption={`n = ${n.toLocaleString('en-US')}`} columns={columns} rows={tableRows} />
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function DescriptiveCharts({ result, colName, precision, height, onReady, onPurge }: {
  result: DescriptiveResult; colName: string; precision: number; height: number
  onReady: (figure: unknown, element: HTMLElement) => void
  onPurge: () => void
}) {
  const { histogram, boxData } = result

  // Build histogram bin centers and width
  const histX = histogram.binEdges.slice(0, -1).map(
    (lo, i) => (lo + histogram.binEdges[i + 1]) / 2
  )
  const histWidth = histogram.binEdges.length > 1
    ? histogram.binEdges[1] - histogram.binEdges[0]
    : 1

  const fmt = (v: number) => formatNumber(v, precision)

  // Invisible scatter marker on the box strip — one per stat, gives clean
  // individual hover labels. opacity:0 = invisible, size:14 = generous hit area.
  const statPoint = (label: string, x: number) => ({
    type: 'scatter' as const,
    mode: 'markers' as const,
    x: [x], y: [0],
    xaxis: 'x', yaxis: 'y2',
    marker: { opacity: 0, size: 14, color: PLOT_COLORS.data },
    hovertemplate: `${label}: ${fmt(x)}<extra></extra>`,
    showlegend: false,
  })

  // ── Traces ──────────────────────────────────────────────────────────────
  const traces = [
    // Histogram (bottom subplot)
    {
      type: 'bar' as const,
      x: histX,
      y: histogram.counts,
      width: histWidth,
      marker: HISTOGRAM_MARKER,
      // Pass bin edges so the hover template can show the range instead of the center
      customdata: histogram.binEdges.slice(0, -1).map((lo, i) => [
        formatNumber(lo, precision),
        formatNumber(histogram.binEdges[i + 1], precision),
      ]),
      hovertemplate: '%{customdata[0]} – %{customdata[1]}<br>Count: %{y}<extra></extra>',
      showlegend: false,
    },
    // ── Invisible stat-point overlays for individual hover labels ────────────
    // One scatter marker per key stat on the box strip. opacity:0 = invisible,
    // size:14 = generous hit area. hovermode:'closest' ensures only one fires.
    statPoint('Lower fence', boxData.whiskerLo),
    statPoint('Q1',          boxData.q1),
    statPoint('Median',      boxData.median),
    statPoint('Mean',        result.summary.mean),
    statPoint('Q3',          boxData.q3),
    statPoint('Upper fence', boxData.whiskerHi),
    // Outliers — one scatter trace covering all outlier values
    ...(boxData.outliers.length > 0 ? [{
      type: 'scatter' as const,
      mode: 'markers' as const,
      x: boxData.outliers,
      y: boxData.outliers.map(() => 0),
      xaxis: 'x', yaxis: 'y2',
      marker: { opacity: 0.85, size: 10, color: PLOT_COLORS.outlier },
      customdata: formatAll(boxData.outliers, precision),
      hovertemplate: 'Outlier: %{customdata}<extra></extra>',
      showlegend: false,
    }] : []),
  ]

  // ── Layout ──────────────────────────────────────────────────────────────
  const layout = baseLayout({
    margin: { t: 12, b: 48, l: 52, r: 12 },
    autosize: true,
    height,
    dragmode: 'pan' as const,
    hovermode: 'closest' as const,
    xaxis: { ...PLOT_AXIS, title: { text: colName }, tickformat: '.4~g', nticks: 6, automargin: true },
    yaxis: { ...PLOT_AXIS, title: { text: 'Frequency' }, domain: [0, BOX.histTop], tickformat: 'd', automargin: true },
    // The box strip: hover points and outliers sit at y = 0, the middle of the strip.
    yaxis2: { domain: [BOX.bottom, 1], range: [-1, 1], showticklabels: false, showgrid: false, zeroline: false, fixedrange: true },
    shapes: [
      // Box plot (Tukey), drawn as shapes so the mean and median lines below cross it unchanged.
      { type: 'line' as const, xref: 'x' as const, x0: boxData.whiskerLo, x1: boxData.q1, yref: 'paper' as const, y0: BOX.middle, y1: BOX.middle, line: { color: PLOT_COLORS.data, width: 1.5 } },
      { type: 'line' as const, xref: 'x' as const, x0: boxData.q3, x1: boxData.whiskerHi, yref: 'paper' as const, y0: BOX.middle, y1: BOX.middle, line: { color: PLOT_COLORS.data, width: 1.5 } },
      ...[boxData.whiskerLo, boxData.whiskerHi].map((x) => (
        { type: 'line' as const, xref: 'x' as const, x0: x, x1: x, yref: 'paper' as const, y0: BOX.capLow, y1: BOX.capHigh, line: { color: PLOT_COLORS.data, width: 1.5 } })),
      { type: 'rect' as const, xref: 'x' as const, x0: boxData.q1, x1: boxData.q3, yref: 'paper' as const, y0: BOX.low, y1: BOX.high,
        fillcolor: PLOT_COLORS.dataBand, line: { color: PLOT_COLORS.data, width: 1.5 } },
      // Mean and median: drawn over the histogram and again across the box only, leaving the gap between them blank.
      ...[
        { x: result.summary.mean, line: { color: PLOT_COLORS.mean, width: 2, dash: 'dash' } },
        { x: boxData.median, line: { color: PLOT_COLORS.median, width: 2, dash: 'dot' } },
      ].flatMap(({ x, line }) => [[0, BOX.histTop], [BOX.low, BOX.high]].map(([y0, y1]) => (
        { type: 'line' as const, xref: 'x' as const, x0: x, x1: x, yref: 'paper' as const, y0, y1, line }))),
    ],
  })

  return (
    <>
      <Plot
        data={traces}
        layout={layout}
        config={PLOT_CONFIG}
        useResizeHandler
        style={{ width: '100%', height }}
        onInitialized={onReady}
        onUpdate={onReady}
        onPurge={onPurge}
      />
      <Legend items={[
        { label: 'Histogram (count per bin)', kind: 'area', color: PLOT_COLORS.data },
        { label: 'Mean', kind: 'dashed', color: PLOT_COLORS.mean, value: fmt(result.summary.mean) },
        { label: 'Median', kind: 'dotted', color: PLOT_COLORS.median, value: fmt(boxData.median) },
        { label: 'Box Q1', kind: 'area', color: PLOT_COLORS.data, value: `${fmt(boxData.q1)} – Q3 ${fmt(boxData.q3)}` },
        { label: 'Whiskers', kind: 'solid', color: PLOT_COLORS.data, value: `${fmt(boxData.whiskerLo)} – ${fmt(boxData.whiskerHi)}` },
        { label: 'Outliers', kind: 'dot', color: PLOT_COLORS.outlier, value: String(boxData.outliers.length) },
      ]} />
      <p className="est-note">Box plot: the whiskers sit at the fences, Q1 − 1.5 × IQR and Q3 + 1.5 × IQR, even where no value lies that far out; circles are values beyond them.</p>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DescriptiveObservationProps {
  result: DescriptiveResult | null
  config: DescriptiveConfig | null
  /** The rows of the statistics that are ticked. */
  rows: StatRow[]
  precision: number
  isComputing?: boolean
  error?: string | null
  onRetry?: () => void
  /** Backend warnings, shown under the table they are about. */
  warnings?: readonly string[]
}

export default function DescriptiveObservation({
  result, config, rows: visibleRows, precision, isComputing = false, error = null, onRetry, warnings = [],
}: DescriptiveObservationProps) {
  const registry = useChartRegistry(CHART_ORDER)
  const baseName = config ? `descriptive-${config.column}` : 'descriptive-statistics'
  const exportCSV = useCallback(() => {
    if (!result || !config) throw new Error('No applied descriptive result is available.')
    downloadCSV([
      ['category', 'statistic', 'value', 'normal_corrected', 'normal_corrected_properties', 'warning'],
      ...visibleRows.map((row) => [row.category, row.measure, row.value, row.consistencyCorr, estimatorTags(row, true).join(' '), row.warning ?? '']),
    ], exportFilename(baseName, 'csv', 'descriptive-statistics'))
  }, [result, config, visibleRows, baseName])
  const exportPNG = useCallback(() => downloadChartsPNG(registry.charts,
    exportFilename(`${baseName}-chart`, 'png', 'descriptive-statistics')), [registry.charts, baseName])
  const exportPDF = useCallback(async () => {
    if (!result || !config) throw new Error('No applied descriptive result is available.')
    await downloadPDF({
      title: `Descriptive Statistics - ${config.column}`,
      subtitle: `n = ${result.summary.n}`,
      charts: registry.charts,
      stats: [
        { label: 'Mean', value: String(result.summary.mean) },
        { label: 'Median', value: String(result.summary.median) },
        { label: 'Standard deviation', value: String(result.summary.std) },
        { label: 'IQR', value: String(result.summary.iqr) },
      ],
      tables: [{ title: 'Statistics', columns: ['Category', 'Statistic', 'Value', 'Normal-corrected'],
        rows: visibleRows.map((row) => [row.category, row.measure, row.value, row.consistencyCorr]) }],
      filename: exportFilename(`${baseName}-report`, 'pdf', 'descriptive-statistics'),
    })
  }, [result, config, registry.charts, visibleRows, baseName])
  const exportReady = !!result && !!config && !isComputing && registry.ready

  return (
    <ResultsFrame title={config ? `Descriptive Statistics · ${config.column}` : 'Descriptive Statistics'} n={result?.summary.n}
      updating={isComputing} error={error} onRetry={onRetry}
      exports={exportReady ? { png: exportPNG, csv: exportCSV, pdf: exportPDF } : undefined}
      exportReady={exportReady} exportReason={isComputing ? 'Waiting for the updated result.' : 'Chart is still loading.'}>
      {!result || !config ? (
        isComputing ? <p className="est-note">Computing the statistics…</p> : null
      ) : (
        <>
          <ResultsSection title="Statistics">
            {visibleRows.length > 0
              ? <StatsTable rows={visibleRows} showConsistencyCorr={config.showConsistencyCorr} precision={precision} n={result.summary.n} />
              : <p className="est-note">Tick at least one statistic under What to show.</p>}
            <Warnings items={warnings} />
          </ResultsSection>
          <ResultsSection title="Histogram and box plot">
            <PlotBox>
              {(height) => (
                <DescriptiveCharts result={result} colName={config.column} precision={precision} height={height}
                  onReady={registry.register('descriptive', `Distribution of ${config.column}`)}
                  onPurge={registry.unregister('descriptive')} />
              )}
            </PlotBox>
          </ResultsSection>
        </>
      )}
    </ResultsFrame>
  )
}
