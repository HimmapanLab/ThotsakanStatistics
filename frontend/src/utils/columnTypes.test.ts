import { describe, expect, it } from 'vitest'
import {
  guessType, guessTypes, isNumericColumn, profileColumn, profileColumns, splitColumns, typeFit, typesFromLists, validTypes, variableOptions,
} from './columnTypes'

const rowsOf = (name: string, values: string[]) => values.map((value) => ({ [name]: value }))
const profile = (name: string, values: string[]) => profileColumn(rowsOf(name, values), name)
const timestamps = Array.from({ length: 30 }, (_, i) => `2014-01-01 ${String(i % 24).padStart(2, '0')}:${i < 24 ? '00' : '30'}:00`)

describe('guessing a column type', () => {
  it('calls a timestamp column an ID, because every value is different text', () => {
    expect(guessType(profile('ds', timestamps))).toBe('ID')
  })
  it('calls a near-unique text column an ID even when it has few rows', () => {
    expect(guessType(profile('code', ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']))).toBe('ID')
  })
  it('calls a text column with a few levels Nominal', () => {
    expect(guessType(profile('group', ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']))).toBe('Nominal')
  })
  it('calls a text column with more than 20 levels an ID', () => {
    const many = Array.from({ length: 60 }, (_, i) => `level ${i % 30}`)
    expect(guessType(profile('many', many))).toBe('ID')
  })
  it('calls whole numbers with a few values Discrete and decimals Continuous', () => {
    expect(guessType(profile('count', ['1', '2', '3', '4', '5', '3', '2']))).toBe('Discrete')
    expect(guessType(profile('score', ['1.5', '2.25', '3.1', '4.7']))).toBe('Continuous')
  })
  it('calls a 0/1 flag Nominal, since it names a group', () => {
    expect(guessType(profile('male', ['0', '1', '1', '0', '1']))).toBe('Nominal')
  })
})

describe('the 80% numeric rule', () => {
  it('treats a column as numeric from 80% numbers among the filled cells, ignoring blank, null and NA', () => {
    const column = profile('x', ['1.5', '2.5', '3.5', '4.5', 'oops', '', 'NA', 'null'])
    expect(column.filled).toBe(5)
    expect(column.numericShare).toBeCloseTo(0.8)
    expect(isNumericColumn(column)).toBe(true)
    expect(isNumericColumn(profile('y', ['1.5', '2.5', '3.5', 'a', 'b']))).toBe(false)
  })
})

describe('which types fit a column', () => {
  it('refuses Continuous and Discrete for text, with the reason', () => {
    const fit = typeFit(profile('group', ['A', 'B', 'A']), 'Continuous')
    expect(fit).toEqual({ ok: false, reason: 'Fewer than 80% of the values are numbers.' })
    expect(typeFit(profile('group', ['A', 'B', 'A']), 'Discrete').ok).toBe(false)
  })
  it('refuses Discrete for decimals, but not Continuous', () => {
    const column = profile('score', ['1.5', '2.5', '3.5'])
    expect(typeFit(column, 'Discrete')).toMatchObject({ ok: false, reason: expect.stringContaining('whole numbers') })
    expect(typeFit(column, 'Continuous').ok).toBe(true)
  })
  it('refuses Nominal and Ordinal for more than 20 different values, and always allows ID', () => {
    const column = profile('label', Array.from({ length: 25 }, (_, i) => `item ${i}`))
    expect(typeFit(column, 'Nominal')).toMatchObject({ ok: false, reason: expect.stringContaining('25 different values') })
    expect(typeFit(column, 'Ordinal').ok).toBe(false)
    expect(typeFit(column, 'ID').ok).toBe(true)
  })
})

describe('the two lists the analysis pages read', () => {
  const rows = timestamps.map((ds, i) => ({ ds, group: i % 2 ? 'A' : 'B', score: String(i + 0.5), count: String((i % 5) + 1) }))
  const headers = ['ds', 'group', 'score', 'count']
  const types = guessTypes(profileColumns(headers, rows))

  it('puts Continuous and Discrete in numeric, Ordinal and Nominal in categorical, and an ID in neither', () => {
    expect(types).toEqual({ ds: 'ID', group: 'Nominal', score: 'Continuous', count: 'Discrete' })
    expect(splitColumns(headers, types)).toEqual({ numericCols: ['score', 'count'], categoricalCols: ['group'] })
    expect(splitColumns(headers, { ...types, group: 'Ordinal' }).categoricalCols).toEqual(['group'])
  })
  it('keeps a saved type that still fits and falls back to the guess for one that does not', () => {
    const profiles = profileColumns(headers, rows)
    expect(validTypes(headers, profiles, { group: 'Ordinal', score: 'Nominal', ds: 'Continuous' })).toEqual({
      ds: 'ID', group: 'Ordinal', score: 'Continuous', count: 'Discrete', // 30 levels: Nominal does not fit score
    })
  })
  it('turns the older two saved lists into types, with an unlisted column an ID', () => {
    const profiles = profileColumns(headers, rows)
    expect(typesFromLists(headers, profiles, ['score', 'count'], ['group'])).toEqual(types)
  })
})

describe('variableOptions', () => {
  it('names each column with its type, and keeps the bare name as the value', () => {
    expect(variableOptions(['Demand', 'Holiday'], { Demand: 'Continuous', Holiday: 'Nominal' })).toEqual([
      { value: 'Demand', label: 'Demand · Continuous' },
      { value: 'Holiday', label: 'Holiday · Nominal' },
    ])
  })
  it('shows just the name when the type is not known', () => {
    expect(variableOptions(['Demand'])).toEqual([{ value: 'Demand', label: 'Demand' }])
  })
})
