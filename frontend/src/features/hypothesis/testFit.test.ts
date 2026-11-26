import { describe, expect, it } from 'vitest'
import { EQUAL_VARIANCE, ONE_SAMPLE_T, ONE_WAY_ANOVA, TWO_SAMPLE_T } from '../../api/hypothesis'
import { testFit } from './testFit'

describe('which hypothesis tests fit the data', () => {
  it('always lets the one-sample test run', () => {
    expect(testFit(ONE_SAMPLE_T, [])).toEqual({ ok: true })
  })

  it('needs a grouping column with at least 2 levels for the two-sample and equal-variance tests', () => {
    expect(testFit(TWO_SAMPLE_T, [{ name: 'Holiday', levels: 2 }])).toEqual({ ok: true })
    expect(testFit(EQUAL_VARIANCE, [{ name: 'Region', levels: 4 }])).toEqual({ ok: true })
    const none = testFit(TWO_SAMPLE_T, [])
    expect(none.ok).toBe(false)
    expect(testFit(EQUAL_VARIANCE, [{ name: 'Flag', levels: 1 }]).ok).toBe(false)
  })

  it('needs 3 or more levels for one-way ANOVA, says why, and points to the test that fits', () => {
    expect(testFit(ONE_WAY_ANOVA, [{ name: 'Region', levels: 3 }])).toEqual({ ok: true })
    const fit = testFit(ONE_WAY_ANOVA, [{ name: 'Holiday', levels: 2 }])
    expect(fit.ok).toBe(false)
    if (!fit.ok) {
      expect(fit.reason).toContain('3 or more groups')
      expect(fit.reason).toContain('Holiday is the only grouping column, with 2')
      expect(fit.reason).toContain('The two-sample t-test fits.')
    }
  })
})
