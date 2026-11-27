import { describe, expect, it } from 'vitest'
import { DEFAULT_SELECTED, estimatorTags, isRowVisible, missingStats, parseQuantiles, statsCsv, statsPdfTable, visibleStatIds } from './descriptiveOptions'

describe('visible statistics', () => {
  it('shows every basic statistic by default and no advanced ones', () => {
    expect(visibleStatIds(DEFAULT_SELECTED)).toEqual(expect.arrayContaining([
      'extremes', 'minimum', 'maximum', 'quantiles', 'central', 'mean', 'median', 'dispersion', 'std_dev_1', 'variance_1',
    ]))
    expect(visibleStatIds(DEFAULT_SELECTED)).not.toContain('iqr')
    expect(visibleStatIds(DEFAULT_SELECTED)).not.toContain('skewness')
  })

  it('hides a basic statistic whose group is unticked, even if it is still ticked', () => {
    const noCentral = DEFAULT_SELECTED.filter(id => id !== 'central')
    expect(visibleStatIds(noCentral)).not.toContain('mean')
    expect(visibleStatIds(noCentral)).toContain('minimum')
  })

  it('lets a single basic statistic be deselected', () => {
    const noMedian = DEFAULT_SELECTED.filter(id => id !== 'median')
    expect(visibleStatIds(noMedian)).toContain('mean')
    expect(visibleStatIds(noMedian)).not.toContain('median')
  })

  it('shows advanced statistics as soon as they are ticked', () => {
    expect(visibleStatIds([...DEFAULT_SELECTED, 'iqr', 'weighted_mean'])).toEqual(expect.arrayContaining(['iqr', 'weighted_mean']))
  })

  it('treats rows without an id as always visible', () => {
    expect(isRowVisible({}, [])).toBe(true)
    expect(isRowVisible({ statId: 'mean' }, ['median'])).toBe(false)
    expect(isRowVisible({ statId: 'mean' }, ['mean'])).toBe(true)
  })
})

describe('parseQuantiles', () => {
  it('accepts a list, the ends 0 and 1, and blank (no quantiles)', () => {
    expect(parseQuantiles('0.25, 0.5, 0.75')).toEqual([0.25, 0.5, 0.75])
    expect(parseQuantiles('0, 1')).toEqual([0, 1])
    expect(parseQuantiles('')).toEqual([])
    expect(parseQuantiles('   ')).toEqual([])
  })

  it('rejects malformed or out-of-range text', () => {
    expect(parseQuantiles('0.25,')).toBeNull()
    expect(parseQuantiles('a, 0.5')).toBeNull()
    expect(parseQuantiles('1.5')).toBeNull()
    expect(parseQuantiles('-0.1')).toBeNull()
  })
})

describe('estimatorTags', () => {
  const row = (statId: string) => ({ statId, consistencyCorr: 1 })
  it('marks the ddof = 1 variance unbiased even without the normal-corrected column', () => {
    expect(estimatorTags(row('variance_1'), false)).toEqual(['Unbiased', 'Consistent'])
    expect(estimatorTags(row('variance_0'), false)).toEqual(['Consistent'])
    expect(estimatorTags(row('std_dev_1'), false)).toEqual(['Consistent'])
    expect(estimatorTags(row('variance_0'), true)).toEqual(['Unbiased', 'Consistent'])
  })
})

describe('ticked statistics the backend sent no row for', () => {
  const request = { weightsCol: null, trimAlpha: null, winsorLimits: null }
  const rowsWithMinimum = (value: number | null) => [{ statId: 'minimum', value }, { statId: 'mean', value: 1 }]

  it('says geometric and harmonic means need values above 0 when the minimum is not above 0', () => {
    const missing = missingStats(['geometric_mean', 'harmonic_mean'], rowsWithMinimum(-1), request)
    expect(missing.map((stat) => [stat.measure, stat.reason])).toEqual([
      ['Geometric mean', 'Needs all values above 0'], ['Harmonic mean', 'Needs all values above 0'],
    ])
    expect(missing[0].category).toBe('Central Tendency')
  })

  it('says to choose a weights column for the weighted mean, and a generic reason when it cannot say why', () => {
    expect(missingStats(['weighted_mean'], rowsWithMinimum(2), request)[0].reason).toBe('Choose a weights column')
    expect(missingStats(['weighted_mean'], rowsWithMinimum(2), { ...request, weightsCol: 'w' })[0].reason).toBe('Not computed for this data')
    expect(missingStats(['geometric_mean'], rowsWithMinimum(2), request)[0].reason).toBe('Not computed for this data')
  })

  it('asks for the trim fraction and the winsor limits when they are blank', () => {
    expect(missingStats(['trimmed_mean', 'winsorized_mean'], rowsWithMinimum(2), request).map((stat) => stat.reason))
      .toEqual(['Enter a trim fraction', 'Enter the winsor limits'])
  })

  it('lists nothing for a statistic that has its row, or that is not ticked', () => {
    expect(missingStats(['geometric_mean'], [...rowsWithMinimum(2), { statId: 'geometric_mean', value: 3 }], request)).toEqual([])
    expect(missingStats(['mean'], rowsWithMinimum(2), request)).toEqual([])
  })
})

describe('exports follow the table on screen', () => {
  const row = { category: 'Dispersion', measure: 'MAD', value: 1, consistencyCorr: 1.48, robust: true, statId: 'mad' }

  it('includes the Normal-corrected columns only while they are shown', () => {
    expect(statsCsv([row], true)[0]).toEqual(['category', 'statistic', 'value', 'normal_corrected', 'normal_corrected_properties', 'robust', 'warning'])
    expect(statsCsv([row], true)[1]).toEqual(['Dispersion', 'MAD', 1, 1.48, 'Consistent', true, ''])
    expect(statsCsv([row], false)[0]).toEqual(['category', 'statistic', 'value', 'robust', 'warning'])
    expect(statsCsv([row], false)[1]).toEqual(['Dispersion', 'MAD', 1, true, ''])
    expect(statsPdfTable([row], true)).toEqual({ columns: ['Category', 'Statistic', 'Value', 'Normal-corrected'], rows: [['Dispersion', 'MAD', 1, 1.48]] })
    expect(statsPdfTable([row], false)).toEqual({ columns: ['Category', 'Statistic', 'Value'], rows: [['Dispersion', 'MAD', 1]] })
  })
})
