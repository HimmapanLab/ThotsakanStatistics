import { describe, expect, it } from 'vitest'
import { pdfStats, reportsAlpha } from './inferencePresentation'

const intervals = { estimationType: 'Confidence and Prediction Intervals', add_ci_box: false, alpha: 0.1 }
const regions = { estimationType: 'Confidence Regions', add_ci_box: false, alpha: 0.05 }

describe('the Inference PDF summary', () => {
  it('names α for intervals, and for regions only with the marginal interval box', () => {
    expect(reportsAlpha(intervals)).toBe(true)
    expect(reportsAlpha({ ...regions, add_ci_box: true })).toBe(true)
    expect(pdfStats(intervals, 'height', null)).toEqual([{ label: 'Variable', value: 'height' }, { label: 'Alpha', value: 0.1 }])
  })

  it('leaves α out for confidence regions without the interval box, where the page does not show it', () => {
    expect(reportsAlpha(regions)).toBe(false)
    expect(pdfStats(regions, 'height', null)).toEqual([{ label: 'Variable', value: 'height' }])
  })

  it('adds the partial-result note last', () => {
    expect(pdfStats(intervals, 'height', 'One section failed.').map((stat) => stat.label)).toEqual(['Variable', 'Alpha', 'Partial result'])
  })
})
