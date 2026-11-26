import { EQUAL_VARIANCE, ONE_WAY_ANOVA, TWO_SAMPLE_T } from '../../api/hypothesis'

/** A column that can make groups, with how many different values (levels) it has. */
export interface GroupColumn { name: string; levels: number }

export type TestFit = { ok: true } | { ok: false; reason: string }

/** The smallest number of levels a grouping column needs for each test that compares groups. */
const LEVELS_NEEDED: Readonly<Record<string, number>> = {
  [TWO_SAMPLE_T]: 2, [EQUAL_VARIANCE]: 2, [ONE_WAY_ANOVA]: 3,
}

function describeGroups(columns: readonly GroupColumn[]): string {
  if (columns.length === 0) return 'Your data has no grouping column; change a column’s type in the Data drawer.'
  if (columns.length === 1) return `Your data: ${columns[0].name} is the only grouping column, with ${columns[0].levels}.`
  return `Your data: ${columns.map((column) => `${column.name} (${column.levels})`).join(', ')} are the grouping columns.`
}

/**
 * Whether the data can run a test, and if not, why (shown under the greyed test). Two-sample and equal-variance
 * tests need a Nominal or Ordinal column with at least 2 levels, one-way ANOVA one with at least 3. The one-sample
 * test needs no groups, so it always fits (a numeric variable is already picked).
 */
export function testFit(test: string, columns: readonly GroupColumn[]): TestFit {
  const needed = LEVELS_NEEDED[test]
  if (needed === undefined || columns.some((column) => column.levels >= needed)) return { ok: true }
  const groups = needed === 2 ? 'at least 2 groups' : '3 or more groups'
  const other = needed === 3 && columns.some((column) => column.levels === 2) ? ' The two-sample t-test fits.'
    : needed === 2 && columns.some((column) => column.levels >= 3) ? ' One-way ANOVA fits.' : ''
  return { ok: false, reason: `Needs a Nominal or Ordinal column with ${groups}. ${describeGroups(columns)}${other}` }
}
