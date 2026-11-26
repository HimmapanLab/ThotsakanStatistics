import Papa from 'papaparse'
import { guessTypes, profileColumns, splitColumns, type ColumnProfile } from './columnTypes'

export interface ParsedDataset {
  headers: string[]
  rows: Record<string, string>[]     // raw strings
  numericCols: string[]             // Continuous and Discrete columns
  categoricalCols: string[]         // Ordinal and Nominal columns; an ID column is in neither list
  /** What the column types were guessed from; DataContext computes it when a dataset does not carry one. */
  profiles?: Record<string, ColumnProfile>
}

export async function parseFile(file: File): Promise<ParsedDataset> {
  const name = file.name.toLowerCase()
  // The server reads comma-separated .csv only; the preview must see the same columns.
  if (!name.endsWith('.csv')) {
    throw new Error('Only CSV files are supported.')
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: ',',
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0].message))
          return
        }

        const rows = results.data
        const headers = results.meta.fields ?? []

        // The app's first guess at each column's type; Continuous and Discrete are numeric, Ordinal and
        // Nominal are categorical, and an ID column is neither (utils/columnTypes.ts).
        const profiles = profileColumns(headers, rows)
        const { numericCols, categoricalCols } = splitColumns(headers, guessTypes(profiles))

        resolve({ headers, rows, numericCols, categoricalCols, profiles })
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

/** Get all unique values in a categorical column */
export function uniqueValues(rows: Record<string, string>[], col: string): string[] {
  return [...new Set(rows.map((r) => r[col] ?? '').filter((v) => v !== ''))].sort()
}
