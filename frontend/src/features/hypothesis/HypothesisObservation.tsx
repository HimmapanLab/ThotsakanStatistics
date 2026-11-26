import { useMemo } from 'react';
import ReactPlotly from 'react-plotly.js';
import type { HypothesisResponse, RejectionRegionData } from '../../api/hypothesis';
import ExportMenu from '../../components/ExportMenu';
import ResultTable from '../../components/ResultTable';
import StatusBanner, { EmptyState } from '../../components/StatusBanner';
import { FormulaButton, GatePrompt, ResultsHead } from '../../components/lab';
import { PLOT_AXIS, PLOT_COLORS, PLOT_CONFIG, baseLayout } from '../../plot/theme';
import { useChartRegistry } from '../../hooks/useChartRegistry';
import { downloadChartsPNG } from '../../utils/exportPNG';
import { downloadCSV } from '../../utils/exportCSV';
import { downloadPDF } from '../../utils/exportPDF';
import { exportFilename } from '../../utils/exportFilename';
import { formatCell, formatCount, formatDof, formatNumber } from '../../utils/formatNumber';
import { Block, DataTable, Legend, Out, PlotFrame, type TableColumn } from './ui/blocks';
import { HYP_FORMULA_NOTE } from './ui/formulaNotes';

const CHART_ORDER = ['hypothesis'] as const;

interface HypothesisObservationProps {
  result: HypothesisResponse | null;
  hasData: boolean;
  /** A dataset is loaded (it may have no numeric variables). */
  loaded: boolean;
  /** A variable is picked; until then the results only say what to do. */
  picked?: boolean;
  /** The picked variable, named under the title. */
  column?: string;
  precision: number;
  isComputing: boolean;
  isDirty: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const C_REJECT = PLOT_COLORS.reject;
const C_P_AREA = PLOT_COLORS.pValue;
const C_CURVE = PLOT_COLORS.referenceMuted;
const C_CRIT = PLOT_COLORS.rejectLine;
const C_STAT = PLOT_COLORS.statistic;

const DIST_LABEL: Record<RejectionRegionData['dist'], string> = { t: 't', chi2: 'χ²', f: 'F' };

/** Statistic symbol shown on the axis and the marker, per null distribution. */
function statSymbol(dist: RejectionRegionData['dist']): string {
  return dist === 't' ? 't' : dist === 'chi2' ? 'χ²' : 'F';
}

/** Pin a value to the plotted domain so an off-scale marker still draws, at the edge. */
function clampToRange(value: number, [lo, hi]: [number, number]): number {
  return Math.min(Math.max(value, lo), hi);
}

/** Label for a statistic pinned to the edge, so the real value is never hidden. */
function offscaleAnnotation(region: RejectionRegionData, precision: number): any {
  const beyondUpper = region.statistic > region.x_range[1];
  return {
    x: clampToRange(region.statistic, region.x_range),
    y: region.y_max,
    xanchor: beyondUpper ? 'right' : 'left',
    yanchor: 'top',
    text: `${statSymbol(region.dist)} = ${formatNumber(region.statistic, precision)} ${beyondUpper ? '→' : '←'}`,
    showarrow: false,
    font: { color: C_STAT, size: 12 },
    bgcolor: PLOT_COLORS.hoverBg,
    borderpad: 3,
  };
}

/** The slice of the curve lying inside [lo, hi], as a filled polygon. */
function shade(region: RejectionRegionData, lo: number, hi: number, color: string) {
  const xs: number[] = [];
  const ys: number[] = [];
  region.x.forEach((x, i) => {
    if (x >= lo && x <= hi) { xs.push(x); ys.push(region.pdf[i]); }
  });
  if (xs.length === 0) return null;
  return {
    x: xs,
    y: ys,
    type: 'scatter',
    mode: 'lines',
    fill: 'tozeroy',
    fillcolor: color,
    line: { width: 0 },
    hoverinfo: 'skip',
  };
}

/** pingouin's result table, as returned: one row per test (two for ANOVA). */
function parseTable(result: HypothesisResponse | null): Record<string, unknown>[] {
  if (!result || !result.table) return [];
  try {
    return JSON.parse(result.table);
  } catch {
    return [];
  }
}

/**
 * pingouin's table, as returned. It is not all numeric (`CI95` is an array, `BF10` a string, the ANOVA
 * "Within" row all nulls), so each cell goes through `formatCell`.
 */
function RawTable({ rows, precision }: { rows: Record<string, unknown>[]; precision: number }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]).map((key) => ({ key, label: key, align: 'right' as const }));
  return <ResultTable caption="Detailed test output" columns={columns}
    rows={rows.map((row) => ({ cells: Object.fromEntries(columns.map(({ key }) => [key, formatCell(row[key], precision)])) }))} />;
}

/**
 * The results: hypotheses, the test result (with its warnings), the group summary and the detailed output as
 * tables, then the null-distribution plot. There is no verdict: the numbers and the picture are the answer,
 * and the user decides (Irving's rule). While the next result loads the last one stays, dimmed.
 */
export default function HypothesisObservation({
  result, hasData, loaded, picked = true, column = '', precision, isComputing, isDirty, error = null, onRetry,
}: HypothesisObservationProps) {
  const registry = useChartRegistry(CHART_ORDER);
  const rows = useMemo(() => parseTable(result), [result]);
  const traces = useMemo(() => {
    if (!result) return [];
    const region = result.rejection_region;
    const out: any[] = [];

    // 1. Rejection region — fixed by α.
    region.reject_region.forEach(([lo, hi]) => {
      const t = shade(region, lo, hi, C_REJECT);
      if (t) out.push(t);
    });

    // 2. p-value area — fixed by the observed statistic.
    region.p_area.forEach(([lo, hi]) => {
      const t = shade(region, lo, hi, C_P_AREA);
      if (t) out.push(t);
    });

    // 3. The null density itself.
    out.push({
      x: region.x, y: region.pdf, type: 'scatter', mode: 'lines',
      line: { color: C_CURVE, width: 2, dash: 'dot' }, hoverinfo: 'skip',
    });

    // 4. Critical value(s).
    region.critical_values.forEach((cv) => {
      out.push({
        x: [cv, cv], y: [0, region.y_max], type: 'scatter', mode: 'lines',
        line: { color: C_CRIT, width: 1.5, dash: 'dash' },
        hovertemplate: `critical ${statSymbol(region.dist)} = ${formatNumber(cv, precision)}<extra></extra>`,
      });
    });

    // 5. The observed statistic, drawn last so it sits on top. A statistic far
    //    outside the null scale is pinned to the axis edge — the grid stays on
    //    the curve's scale, and the annotation below carries the true value.
    const at = clampToRange(region.statistic, region.x_range);
    out.push({
      x: [at, at], y: [0, region.y_max],
      type: 'scatter', mode: 'lines', line: { color: C_STAT, width: 2.5 },
      hovertemplate: `${statSymbol(region.dist)} = ${formatNumber(region.statistic, precision)}<extra></extra>`,
    });

    return out;
  }, [result, precision]);

  if (!hasData) {
    return <EmptyState loaded={loaded} hasData={false} />;
  }

  if (!picked) {
    return <GatePrompt text="Step 1 on the left: choose the column you want to look at. The next steps open when you do." />;
  }

  if (!result) {
    return <>
      <StatusBanner isComputing={isComputing} error={error} hasResult={false} onRetry={onRetry} />
      {!isComputing && !error && <EmptyState loaded hasData />}
    </>;
  }

  const region = result.rejection_region;
  const symbol = statSymbol(region.dist);
  const dofLabel = region.dof.map((d) => formatDof(d, precision)).join(', ');
  const crit = region.critical_values.map((c) => formatNumber(c, precision));
  const critLabel = region.tail === 'two-sided' && region.critical_values.length > 1
    ? `±${formatNumber(Math.abs(region.critical_values[1]), precision)}` : crit.join(', ');
  const first = rows[0] ?? {};
  const ciKey = Object.keys(first).find((key) => /^CI95/.test(key));
  const ci = ciKey ? first[ciKey] : undefined;
  const ciPair = Array.isArray(ci) && ci.length === 2 ? (ci as number[]) : null;
  const effect = first['cohen-d'];
  const baseName = `hypothesis-${result.test_type}`;
  const updating = isComputing || isDirty;
  const canExport = !isDirty && !isComputing && registry.ready;
  const exportHandlers = canExport ? {
    png: () => downloadChartsPNG(registry.charts, exportFilename(`${baseName}-chart`, 'png', 'hypothesis')),
    csv: () => downloadCSV([
      ['section', 'metric', 'group', 'value'],
      ['settings', 'test_type', '', result.test_type],
      ['settings', 'alpha', '', result.alpha],
      ['result', 'statistic', '', result.statistic],
      ['result', 'p_value', '', result.p_value],
      ['result', 'degrees_of_freedom', '', region.dof.join('; ')],
      ['result', 'critical_values', '', region.critical_values.join('; ')],
      ...((result.group_summary ?? []).flatMap((group) => [
        ['group_summary', 'n', group.name, group.n],
        ['group_summary', 'mean', group.name, group.mean],
        ['group_summary', 'sd', group.name, group.sd],
        ['group_summary', 'variance', group.name, group.var],
      ])),
    ], exportFilename(baseName, 'csv', 'hypothesis')),
    pdf: () => downloadPDF({
      title: `Hypothesis Test - ${result.test_type}`,
      subtitle: `${result.h0} vs ${result.h1}`,
      charts: registry.charts,
      stats: [
        { label: 'Alpha', value: String(result.alpha) },
        { label: 'Statistic', value: String(result.statistic) },
        { label: 'P-value', value: String(result.p_value) },
        { label: 'Critical values', value: region.critical_values.join(', ') },
      ],
      filename: exportFilename(`${baseName}-report`, 'pdf', 'hypothesis'),
    }),
  } : undefined;

  // Columns the test does not report (a confidence interval for ANOVA, an effect size for Levene) are left out.
  const resultColumns: TableColumn[] = [
    { key: 'stat', label: `Statistic (${symbol})`, num: true },
    { key: 'df', label: 'df', num: true },
    { key: 'p', label: 'p-value', num: true },
    { key: 'alpha', label: 'α', num: true },
    { key: 'crit', label: 'Critical value', num: true },
    ...(ciPair ? [{ key: 'ci', label: 'CI 95%', num: true }] : []),
    ...(typeof effect === 'number' ? [{ key: 'd', label: 'Cohen’s d', num: true }] : []),
  ];
  const resultCells: Record<string, string> = {
    stat: formatNumber(result.statistic, precision),
    df: dofLabel,
    p: formatNumber(result.p_value, precision),
    alpha: String(result.alpha),
    crit: critLabel,
    ...(ciPair ? { ci: `[${formatNumber(ciPair[0], precision)}, ${formatNumber(ciPair[1], precision)}]` } : {}),
    ...(typeof effect === 'number' ? { d: formatNumber(effect, precision) } : {}),
  };

  return (
    <Out updating={updating}>
      <ResultsHead title={`Hypothesis Testing · ${result.test_type}`} sub={column || undefined}>
        <ExportMenu handlers={exportHandlers} ready={canExport}
          disabledReason={isDirty ? 'Waiting for the updated result.' : isComputing ? 'Waiting for the result.' : 'Chart is still loading.'} />
      </ResultsHead>
      <StatusBanner isComputing={false} error={error} hasResult onRetry={onRetry} />

      <Block title="Hypotheses">
        <dl className="hp-hyps">
          <dt>H₀</dt><dd>{result.h0}</dd>
          <dt>H₁</dt><dd>{result.h1}</dd>
        </dl>
      </Block>

      <Block title="Test result" fx={<FormulaButton title={result.test_type}>{HYP_FORMULA_NOTE}</FormulaButton>}>
        <DataTable caption={result.test_type} visibleCaption columns={resultColumns} rows={[{ cells: resultCells }]} />
        {ciPair && <p className="hp-note">The CI 95% interval has 95% confidence, whatever α is.</p>}
        {result.warnings.length > 0 && (
          <ul aria-label="Warnings" className="hp-warnings">
            {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </Block>

      {result.group_summary && result.group_summary.length > 0 && (
        <Block title="Group summary">
          <DataTable caption="Group summary" columns={[
            { key: 'name', label: 'Group' }, { key: 'n', label: 'n', num: true },
            { key: 'mean', label: 'Mean', num: true }, { key: 'sd', label: 'SD', num: true },
          ]} rows={result.group_summary.map((group) => ({ cells: {
            name: group.name, n: formatCount(group.n), mean: formatNumber(group.mean, precision), sd: formatNumber(group.sd, precision),
          } }))} />
        </Block>
      )}

      {rows.length > 0 && (
        <details className="hp-details">
          <summary>Detailed output</summary>
          <RawTable rows={rows} precision={precision} />
          <p className="hp-note" style={{ marginTop: 8 }}>
            Values use {precision} decimal places; a value too small to show that way uses scientific notation.
            Any CI95 interval has 95% confidence, regardless of α.
          </p>
        </details>
      )}

      <Block title={`Null distribution · ${DIST_LABEL[region.dist]}(${dofLabel})`}>
        <PlotFrame label={`Null distribution. Observed ${symbol} statistic ${formatNumber(region.statistic, precision)}; critical boundaries ${crit.join(', ')}. p-value ${formatNumber(result.p_value, precision)}.`}>
          {(height) => (
            <ReactPlotly
              data={traces}
              layout={{
                ...baseLayout({ autosize: true, height }),
                margin: { l: 52, r: 20, t: 12, b: 48 },
                xaxis: {
                  ...PLOT_AXIS,
                  range: region.x_range,
                  title: { text: `${symbol} statistic`, standoff: 6 },
                },
                yaxis: { ...PLOT_AXIS, range: [0, region.y_max * 1.05], title: { text: 'density', standoff: 6 } },
                annotations: region.statistic_offscale ? [offscaleAnnotation(region, precision)] : [],
              }}
              config={PLOT_CONFIG}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
              onInitialized={registry.register('hypothesis', 'Null distribution and rejection region')}
              onUpdate={registry.register('hypothesis', 'Null distribution and rejection region')}
              onPurge={registry.unregister('hypothesis')}
            />
          )}
        </PlotFrame>
        <Legend items={[
          { label: 'Solid: observed statistic', swatch: { width: 20, borderTop: `2px solid ${C_STAT}` } },
          { label: 'Dashed: critical boundary', swatch: { width: 20, borderTop: `2px dashed ${C_CRIT}` } },
          { label: 'Dotted: null density', swatch: { width: 20, borderTop: `2px dotted ${C_CURVE}` } },
          { label: 'Red area: rejection region', swatch: { width: 16, height: 12, background: C_REJECT, border: `1px solid ${C_CRIT}` } },
          { label: 'Blue area: p-value', swatch: { width: 16, height: 12, background: C_P_AREA } },
        ]} />
      </Block>
    </Out>
  );
}
