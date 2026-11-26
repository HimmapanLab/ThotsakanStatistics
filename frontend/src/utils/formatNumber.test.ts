import { describe, expect, it } from 'vitest'
import { clampPrecision, formatAll, formatCell, formatCount, formatDof, formatNumber, MISSING } from './formatNumber'

describe('formatNumber', () => {
  it('shows the chosen number of decimals', () => {
    expect(formatNumber(3.14159, 4)).toBe('3.1416')
    expect(formatNumber(2, 4)).toBe('2.0000')
    expect(formatNumber(-12.5, 2)).toBe('-12.50')
    expect(formatNumber(0, 3)).toBe('0.000')
  })
  it('switches to scientific notation only when a non-zero value would round to zero', () => {
    expect(formatNumber(0.0000123456, 4)).toBe('1.235e-5')
    expect(formatNumber(-0.00001, 4)).toBe('-1.000e-5')
    expect(formatNumber(0.00006, 4)).toBe('0.0001')
    expect(formatNumber(0.00004, 4)).toBe('4.000e-5')
    expect(formatNumber(1e-300, 2)).toBe('1.0e-300')
  })
  it('never shows a negative zero', () => {
    expect(formatNumber(-0, 4)).toBe('0.0000')
  })
  it('marks missing and infinite values', () => {
    expect(formatNumber(null, 4)).toBe(MISSING)
    expect(formatNumber(undefined, 4)).toBe(MISSING)
    expect(formatNumber(NaN, 4)).toBe(MISSING)
    expect(formatNumber(Infinity, 4)).toBe('∞')
    expect(formatNumber(-Infinity, 4)).toBe('-∞')
  })
})

describe('counts, degrees of freedom and generic cells', () => {
  it('shows counts without decimals', () => {
    expect(formatCount(17518)).toBe('17518')
    expect(formatCount(null)).toBe(MISSING)
  })
  it('keeps whole degrees of freedom whole and fractional ones at the precision', () => {
    expect(formatDof(24, 4)).toBe('24')
    expect(formatDof(23.71234, 2)).toBe('23.71')
  })
  it('formats a pingouin cell: arrays, text, nulls and tiny p-values', () => {
    expect(formatCell([1.23456, 2.5], 2)).toBe('[1.23, 2.50]')
    expect(formatCell('3.2e+04', 2)).toBe('3.2e+04')
    expect(formatCell(null, 2)).toBe(MISSING)
    expect(formatCell(0.0000009, 3)).toBe('9.00e-7')
    expect(formatCell(12, 3)).toBe('12')
  })
  it('formats a list for plot hovers', () => {
    expect(formatAll([1, null, 0.5], 2)).toEqual(['1.00', MISSING, '0.50'])
  })
  it('keeps the precision between 2 and 6', () => {
    expect(clampPrecision(9)).toBe(6)
    expect(clampPrecision(1)).toBe(2)
    expect(clampPrecision('5')).toBe(5)
    expect(clampPrecision('x')).toBe(4)
  })
})
