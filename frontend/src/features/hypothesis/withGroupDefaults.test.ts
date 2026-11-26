import { describe, expect, it } from 'vitest';
import { EQUAL_VARIANCE, ONE_SAMPLE_T, ONE_WAY_ANOVA, TWO_SAMPLE_T } from '../../api/hypothesis';
import { initialDraft, MAX_DEFAULT_GROUP_LEVELS, withGroupDefaults } from './useHypothesisTabState';

// The Electricity example: `ds` is a half-hourly timestamp (17,518 unique values), `Holiday` is True/False.
const timestamps = Array.from({ length: 17518 }, (_, i) => `2014-01-01 ${String(i).padStart(5, '0')}`);
const levels: Record<string, string[]> = { ds: timestamps, Holiday: ['False', 'True'], One: ['x'] };
const levelsOf = (column: string) => levels[column] ?? [];

describe('withGroupDefaults', () => {
  it('skips a near-unique column such as a timestamp and picks the first column with few categories', () => {
    const draft = withGroupDefaults({ ...initialDraft('Demand'), testType: TWO_SAMPLE_T }, ['ds', 'Holiday'], levelsOf);
    expect(draft.group1).toMatchObject({ column: 'Holiday', values: ['False'] });
    expect(draft.group2).toMatchObject({ column: 'Holiday', values: ['True'] });
  });

  it('skips a column with a single category', () => {
    const draft = withGroupDefaults({ ...initialDraft('Demand'), testType: EQUAL_VARIANCE }, ['One', 'Holiday'], levelsOf);
    expect(draft.group1.column).toBe('Holiday');
  });

  it('leaves the groups empty when no column qualifies, so nothing huge is sent', () => {
    const draft = withGroupDefaults({ ...initialDraft('Demand'), testType: TWO_SAMPLE_T }, ['ds'], levelsOf);
    expect(draft.group1).toMatchObject({ column: '', values: [] });
    expect(draft.anovaGroup.values).toHaveLength(0);
  });

  it('fills the ANOVA factor only in ANOVA mode', () => {
    const one = withGroupDefaults(initialDraft('Demand'), ['Holiday'], levelsOf);
    expect(one.anovaGroup.values).toHaveLength(0);
    expect(one.group1.column).toBe('');
    const anova = withGroupDefaults({ ...initialDraft('Demand'), testType: ONE_WAY_ANOVA }, ['ds', 'Holiday'], levelsOf);
    expect(anova.anovaGroup).toMatchObject({ column: 'Holiday', values: ['False', 'True'] });
    expect(ONE_SAMPLE_T).not.toBe(ONE_WAY_ANOVA);
  });

  it('caps the default at MAX_DEFAULT_GROUP_LEVELS categories', () => {
    const many = Array.from({ length: MAX_DEFAULT_GROUP_LEVELS + 1 }, (_, i) => `g${i}`);
    const draft = withGroupDefaults({ ...initialDraft('y'), testType: TWO_SAMPLE_T }, ['many'], () => many);
    expect(draft.group1.column).toBe('');
  });
});
