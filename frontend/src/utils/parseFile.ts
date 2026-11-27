import Papa from 'papaparse'
import { guessTypes, isMissingCell, profileColumns, splitColumns, type ColumnProfile } from './columnTypes'

export interface ParsedDataset {
  headers: string[]
  rows: Record<string, string>[]     // raw strings
  numericCols: string[]             // Continuous and Discrete columns
  categoricalCols: string[]         // Ordinal and Nominal columns; an ID column is in neither list
  /** What the column types were guessed from; DataContext computes it when a dataset does not carry one. */
  profiles?: Record<string, ColumnProfile>
  /** Something to tell the reader after the file loads (it looks like the wrong delimiter, or it has no rows). */
  warning?: string
}

/** The names pandas gives the columns of a header row (backend/api/routes/data.py reads the file with it), so
 *  the browser and the server agree: an empty name is "Unnamed: <index>", and a repeated name gets ".1", ".2", ...
 *  (also "x.1" when the file already has one). Named columns are settled before the unnamed ones, as pandas does. */
export function pandasColumnNames(raw: string[]): string[] {
  const names = raw.map((name, i) => (name === '' ? `Unnamed: ${i}` : name))
  const order = [...raw.keys()].sort((a, b) => Number(raw[a] === '') - Number(raw[b] === ''))
  const taken = new Set(names)
  const counts = new Map<string, number>()
  for (const i of order) {
    let name = names[i]
    const old = name
    let count = counts.get(name) ?? 0
    while (count > 0) {
      counts.set(old, count + 1)
      name = `${old}.${count}`
      count = taken.has(name) ? count + 1 : (counts.get(name) ?? 0)
    }
    counts.set(name, count + 1)
    names[i] = name
  }
  return names
}

export const MSG_NO_COLUMNS = 'This file has no columns. Check it is a CSV with a header row.'
export const MSG_NOT_UTF8 = "This file isn't UTF-8 text. In Excel, save it as 'CSV UTF-8'."
export const MSG_HEADER_ONLY = 'This file has a header row but no data rows. Check you chose the right file.'
export const MSG_WRONG_DELIMITER = 'This file has one column. Its values look separated by semicolons or tabs, but only commas are read. In Excel, save it as "CSV UTF-8" (comma delimited).'

/** A short warning to show beside the loaded data, or undefined when the file looks fine. */
function warningFor(headers: string[], rowCount: number): string | undefined {
  if (headers.length === 1 && /[;	]/.test(headers[0])) return MSG_WRONG_DELIMITER
  if (rowCount === 0) return MSG_HEADER_ONLY
  return undefined
}

/** The replacement character a UTF-8 decoder puts where the bytes are not valid UTF-8. */
const hasBadBytes = (cells: string[]) => cells.some((cell) => cell.includes('�'))

export async function parseFile(file: File): Promise<ParsedDataset> {
  const name = file.name.toLowerCase()
  // The server reads comma-separated .csv only; the preview must see the same columns.
  if (!name.endsWith('.csv')) {
    throw new Error('Only CSV files are supported.')
  }

  return new Promise((resolve, reject) => {
    // header: false, so the column names follow pandas' rule instead of PapaParse's ("x_1").
    Papa.parse<string[]>(file, {
      header: false,
      delimiter: ',',
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        const [first, ...body] = results.data
        // Like pandas: no rows, or a first line with nothing in it, is an empty file.
        if (!first || (first.length === 1 && first[0].trim() === '')) {
          reject(new Error(MSG_NO_COLUMNS))
          return
        }
        if (hasBadBytes(first) || body.some(hasBadBytes)) {
          reject(new Error(MSG_NOT_UTF8))
          return
        }

        const headers = pandasColumnNames(first)
        const rows = body.map((cells) => {
          const row: Record<string, string> = {}
          headers.forEach((header, i) => { if (i < cells.length) row[header] = cells[i] })
          return row
        })

        // The app's first guess at each column's type; Continuous and Discrete are numeric, Ordinal and
        // Nominal are categorical, and an ID column is neither (utils/columnTypes.ts).
        const profiles = profileColumns(headers, rows)
        const { numericCols, categoricalCols } = splitColumns(headers, guessTypes(profiles))

        resolve({ headers, rows, numericCols, categoricalCols, profiles, warning: warningFor(headers, rows.length) })
      },
      error: (error: Error) => reject(error),
    })
  })
}

/** Extract a numeric column as a float array, dropping NaN/missing values */
export function extractNumeric(
  rows: Record<string, string>[],
  col: string
): number[] {
  return rows
    .map((r) => parseFloat(r[col] ?? ''))
    .filter((v) => !isNaN(v) && isFinite(v))
}

/** Get all unique values in a categorical column; missing cells (utils/columnTypes.ts) are not levels. */
export function uniqueValues(rows: Record<string, string>[], col: string): string[] {
  return [...new Set(rows.map((r) => r[col] ?? '').filter((v) => !isMissingCell(v)))].sort()
}
