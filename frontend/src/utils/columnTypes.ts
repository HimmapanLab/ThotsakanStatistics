// utils/columnTypes.ts
// Column types (docs/decisions.md, "Column types", 2026-11-26): every column is Continuous, Discrete, Ordinal,
// Nominal or ID. The app guesses a type from the values; the reader can change it, and an option that does not fit
// the values is refused with the reason. Ported from the approved prototype (TYPES, guessType) with the same
// numeric rule as the server: a column is numeric when at least 80 % of its filled cells are numbers.

export const COLUMN_TYPES = ['Continuous', 'Discrete', 'Ordinal', 'Nominal', 'ID'] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

/** One line each, shown under the type name in the type menu. */
export const TYPE_HINT: Record<ColumnType, string> = {
  Continuous: 'Measured on a scale; any value in a range is possible.',
  Discrete: 'Counts or whole numbers.',
  Ordinal: 'Categories that have an order.',
  Nominal: 'Categories without an order, used as groups.',
  ID: 'A label for each row; not analysed.',
}

/** A numeric column must have at least this share of numbers among its filled cells (docs/decisions.md). */
export const NUMERIC_SHARE = 0.8
/** A category column can have at most this many different values. More than that is never a group. */
export const MAX_LEVELS = 20

export interface ColumnProfile {
  name: string
  /** Cells that hold something: not one of the spellings pandas reads as missing (see isMissingCell). */
  filled: number
  /** Share of the filled cells that are numbers, 0 to 1. */
  numericShare: number
  /** Different values among the filled cells. */
  nUnique: number
  /** True when every number in the column is a whole number. */
  wholeNumbers: boolean
  /** True when the column would be numeric if the thousands separators were removed ("1,234"). The server reads
   *  those cells as text too, so this only explains the refusal in the type menu. */
  thousandsSeparated?: boolean
}

/** The spellings pandas' read_csv reads as missing by default (pandas STR_NA_VALUES). The server reads the file
 *  with pandas, so the browser must agree. pandas compares the exact text: it does not trim or ignore case, so
 *  " NA", "none" and "?" are values, not missing. */
const MISSING_SPELLINGS: ReadonlySet<string> = new Set([
  '', '#N/A', '#N/A N/A', '#NA', '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN', '<NA>', 'N/A', 'NA',
  'NULL', 'NaN', 'None', 'n/a', 'nan', 'null',
])

/** A cell pandas reads as missing. One definition for the whole app. */
export function isMissingCell(value: string): boolean {
  return MISSING_SPELLINGS.has(value)
}

/** A cell the server reads as a number: pandas ignores spaces around it, and a cell of only spaces is text. */
const isNumberCell = (value: string) => value.trim() !== '' && !Number.isNaN(Number(value))

const THOUSANDS = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/

export function profileColumn(rows: Record<string, string>[], name: string): ColumnProfile {
  const seen = new Set<string>()
  let filled = 0
  let numbers = 0
  let whole = true
  let thousands = 0
  for (const row of rows) {
    const value = row[name] ?? ''
    if (isMissingCell(value)) continue
    filled++
    seen.add(value)
    if (isNumberCell(value)) {
      numbers++
      if (!Number.isInteger(Number(value))) whole = false
    } else if (THOUSANDS.test(value.trim())) thousands++
  }
  const numericShare = filled === 0 ? 0 : numbers / filled
  return {
    name, filled, numericShare, nUnique: seen.size, wholeNumbers: whole,
    thousandsSeparated: thousands > 0 && numericShare < NUMERIC_SHARE && (numbers + thousands) / filled >= NUMERIC_SHARE,
  }
}

export function profileColumns(headers: string[], rows: Record<string, string>[]): Record<string, ColumnProfile> {
  return Object.fromEntries(headers.map((name) => [name, profileColumn(rows, name)]))
}

export function isNumericColumn(profile: ColumnProfile): boolean {
  return profile.filled > 0 && profile.numericShare >= NUMERIC_SHARE
}

/** The app's first guess. A near-unique text column (a timestamp, an id) is an ID. */
export function guessType(profile: ColumnProfile): ColumnType {
  if (isNumericColumn(profile)) {
    if (profile.wholeNumbers && profile.nUnique <= 2) return 'Nominal' // a 0/1 flag names a group
    if (profile.wholeNumbers && profile.nUnique <= MAX_LEVELS) return 'Discrete'
    return 'Continuous'
  }
  const nearUnique = profile.filled >= 5 && profile.nUnique / profile.filled >= 0.9
  return profile.nUnique <= MAX_LEVELS && !nearUnique ? 'Nominal' : 'ID'
}

const notNumbers = (profile: ColumnProfile) => (profile.thousandsSeparated ? THOUSANDS_HINT : NOT_NUMBERS)

export type TypeFit = { ok: true } | { ok: false; reason: string }

const NOT_NUMBERS = 'Fewer than 80% of the values are numbers.'
const THOUSANDS_HINT = `${NOT_NUMBERS} Values like "1,234" are read as text; remove the thousands separators in the file.`

/** Whether a column may take a type, and if not, why (the reason is shown next to the greyed option). */
export function typeFit(profile: ColumnProfile, type: ColumnType): TypeFit {
  switch (type) {
    case 'Continuous':
      return isNumericColumn(profile) ? { ok: true } : { ok: false, reason: notNumbers(profile) }
    case 'Discrete':
      if (!isNumericColumn(profile)) return { ok: false, reason: notNumbers(profile) }
      return profile.wholeNumbers ? { ok: true } : { ok: false, reason: 'Has decimal values; Discrete needs whole numbers.' }
    case 'Ordinal':
    case 'Nominal':
      return profile.nUnique <= MAX_LEVELS
        ? { ok: true }
        : { ok: false, reason: `Has ${profile.nUnique.toLocaleString('en-US')} different values; a category can have at most ${MAX_LEVELS}.` }
    case 'ID':
      return { ok: true }
  }
}

export const isNumericType = (type: ColumnType) => type === 'Continuous' || type === 'Discrete'
export const isCategoryType = (type: ColumnType) => type === 'Ordinal' || type === 'Nominal'

export type ColumnTypes = Record<string, ColumnType>

export function guessTypes(profiles: Record<string, ColumnProfile>): ColumnTypes {
  return Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [name, guessType(profile)]))
}

/** The two lists the analysis pages read, in header order: Continuous and Discrete are numeric, Ordinal and
 *  Nominal are categorical, ID is neither. */
export function splitColumns(headers: string[], types: ColumnTypes): { numericCols: string[]; categoricalCols: string[] } {
  return {
    numericCols: headers.filter((name) => isNumericType(types[name])),
    categoricalCols: headers.filter((name) => isCategoryType(types[name])),
  }
}

/** Types for a dataset whose reader saved only the two lists (older sessions): numeric becomes Continuous or
 *  Discrete by the values, categorical becomes Nominal (or Ordinal when it had been guessed so), and a column in
 *  neither list is an ID. A column the saved lists do not mention gets the guess. */
export function typesFromLists(
  headers: string[],
  profiles: Record<string, ColumnProfile>,
  numericCols: string[],
  categoricalCols: string[],
): ColumnTypes {
  return Object.fromEntries(headers.map((name) => {
    const profile = profiles[name]
    const guess = guessType(profile)
    if (numericCols.includes(name)) {
      if (isNumericType(guess)) return [name, guess]
      if (!isNumericColumn(profile)) return [name, guess]
      return [name, profile.wholeNumbers && profile.nUnique <= MAX_LEVELS ? 'Discrete' : 'Continuous']
    }
    if (categoricalCols.includes(name)) {
      if (isCategoryType(guess)) return [name, guess]
      return [name, typeFit(profile, 'Nominal').ok ? 'Nominal' : guess]
    }
    return [name, numericCols.length + categoricalCols.length > 0 ? 'ID' : guess]
  }))
}

/** Keep the types that still fit the values; anything else falls back to the guess. */
export function validTypes(
  headers: string[],
  profiles: Record<string, ColumnProfile>,
  wanted: Partial<Record<string, ColumnType>> | undefined,
): ColumnTypes {
  return Object.fromEntries(headers.map((name) => {
    const type = wanted?.[name]
    return [name, type && COLUMN_TYPES.includes(type) && typeFit(profiles[name], type).ok ? type : guessType(profiles[name])]
  }))
}

/** The options of a "Variable" select: the column's name, then its type ("Demand · Continuous"). */
export function variableOptions(columns: readonly string[], types: Partial<ColumnTypes> = {}): { value: string; label: string }[] {
  return columns.map((name) => ({ value: name, label: types[name] ? `${name} · ${types[name]}` : name }))
}
