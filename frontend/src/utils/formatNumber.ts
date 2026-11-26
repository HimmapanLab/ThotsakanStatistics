/**
 * The one display-precision rule (docs/decisions.md, "Display precision", 2026-11-26).
 *
 * - A value shows `precision` decimals.
 * - A value that is not zero but would round to zero shows in scientific notation with `precision`
 *   significant digits (1.234e-5), so a tiny p-value never reads 0.0000.
 * - Counts (n, B, rows, whole-number degrees of freedom) show without decimals.
 * - A missing value is "—". Infinity is "∞".
 *
 * Every table, legend, plot hover and PDF export goes through these functions. CSV export keeps the full value.
 */
export const MISSING = '—'

export const PRECISION_MIN = 2
export const PRECISION_MAX = 6
export const PRECISION_DEFAULT = 4

const isMissing = (value: unknown): value is null | undefined => value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))

export function formatNumber(value: number | null | undefined, precision: number): string {
  if (isMissing(value)) return MISSING
  if (value === Infinity) return '∞'
  if (value === -Infinity) return '-∞'
  if (value !== 0 && Math.abs(value) < 0.5 * 10 ** -precision) {
    return value.toExponential(Math.max(0, precision - 1))
  }
  const fixed = value.toFixed(precision)
  // toFixed keeps the sign of a value that rounds to zero only for -0; show plain zero.
  return /^-0\.?0*$/.test(fixed) ? fixed.slice(1) : fixed
}

/** A whole-number quantity: n, B, a row count. */
export function formatCount(value: number | null | undefined): string {
  if (isMissing(value)) return MISSING
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞'
  return String(Math.round(value))
}

/** Degrees of freedom: whole numbers as counts, Welch-type fractional ones with the usual precision. */
export function formatDof(value: number | null | undefined, precision: number): string {
  return typeof value === 'number' && Number.isInteger(value) ? formatCount(value) : formatNumber(value, precision)
}

/**
 * A cell of a table whose columns are not known in advance (pingouin's detailed output): whole numbers
 * are treated as counts, arrays as intervals, text as written.
 */
export function formatCell(value: unknown, precision: number): string {
  if (isMissing(value)) return MISSING
  if (typeof value === 'number') return Number.isInteger(value) ? formatCount(value) : formatNumber(value, precision)
  if (Array.isArray(value)) return `[${value.map(item => formatCell(item, precision)).join(', ')}]`
  return String(value)
}

/** Labels for Plotly hovers, so a hover shows the same digits as the table next to it. */
export function formatAll(values: ArrayLike<number | null | undefined>, precision: number): string[] {
  return Array.from(values, value => formatNumber(value, precision))
}

export function clampPrecision(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) return PRECISION_DEFAULT
  return Math.min(PRECISION_MAX, Math.max(PRECISION_MIN, n))
}
