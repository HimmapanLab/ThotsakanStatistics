import { useMemo } from 'react';
import type { HypothesisResponse } from '../../api/hypothesis';
import ResultTable from '../../components/ResultTable';
import { EmptyState } from '../../components/StatusBanner';
import { Row, Section } from '../../components/notebook/NotebookParts';
import { formatCell, formatCount, formatDof, formatNumber } from '../../utils/formatNumber';

interface HypothesisNotebookProps {
  result: HypothesisResponse | null;
  precision: number;
}

function parseTable(result: HypothesisResponse | null): Record<string, unknown>[] {
  if (!result || !result.table) return [];
  try {
    return JSON.parse(result.table);
  } catch (e) {
    return [];
  }
}

/**
 * pingouin's result table, as returned: one row per test (two for ANOVA), no statistic types.
 * It is not all numeric (`CI95` is an array, `BF10` a string, the ANOVA "Within" row all nulls),
 * so each cell goes through `formatCell`.
 */
function RawTable({ rows, precision }: { rows: Record<string, unknown>[]; precision: number }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]).map((key) => ({ key, label: key, align: 'right' as const }));
  return <ResultTable caption="Detailed test output" columns={columns}
    rows={rows.map((row) => ({ cells: Object.fromEntries(columns.map(({ key }) => [key, formatCell(row[key], precision)])) }))} />;
}

export default function HypothesisNotebook({ result, precision }: HypothesisNotebookProps) {
  const rows = useMemo(() => parseTable(result), [result]);

  if (!result) return <EmptyState loaded hasData compact />;

  const region = result.rejection_region;
  const dofLabel = region.dof.map((d) => formatDof(d, precision)).join(', ');
  const crit = region.critical_values.map((c) => formatNumber(c, precision));
  const critLabel = region.tail === 'two-sided' ? `±${formatNumber(Math.abs(region.critical_values[1]), precision)}` : crit.join(', ');

  return (
    <div>
      <Section title="Hypotheses">
        <Row label="H₀" value={result.h0} />
        <Row label="H₁" value={result.h1} />
      </Section>

      <Section title="Result">
        <Row label="Statistic" value={formatNumber(result.statistic, precision)} />
        <Row label="Degrees of freedom" value={dofLabel} />
        <Row label="Critical boundary" value={critLabel} />
        <Row label="Significance level α" value={result.alpha} />
        <Row label="p-value" value={formatNumber(result.p_value, precision)} />
      </Section>

      {result.group_summary && result.group_summary.length > 0 && (
        <Section title="Groups">
          {result.group_summary.map((group, index) => <div key={index} className="mb-3">
            <h4 className="break-words text-xs font-semibold text-[var(--color-text)]">{group.name}</h4>
            <Row label="Sample size n" value={formatCount(group.n)} />
            <Row label="Mean" value={formatNumber(group.mean, precision)} />
            <Row label="Standard deviation" value={formatNumber(group.sd, precision)} />
          </div>)}
        </Section>
      )}

      <details className="mb-6">
          <summary className="mb-2 cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Detailed output</summary>
          <RawTable rows={rows} precision={precision} />
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Values use {precision} decimal places; a value too small to show that way uses scientific notation.
            Any CI95 interval has 95% confidence, regardless of α.
          </p>
        </details>
    </div>
  );
}
