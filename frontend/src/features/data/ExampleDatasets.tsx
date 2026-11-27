// features/data/ExampleDatasets.tsx
// Datasets shipped with the app (frontend/public/datasets), loaded exactly like an uploaded file.

import { useState } from 'react'
import { useData } from '../../context/DataContext'

export const EXAMPLE_DATASETS = [
  {
    file: 'WHR_2023_all_years_processed.csv',
    title: 'World Happiness Report 2023',
    description: 'From the UN’s World Happiness Report 2023: life evaluation (Life Ladder) and its explanatory factors for 165 countries, 2005–2023, with subregion and continent.',
    rows: 2363,
    columns: 13,
    isDefault: true,
  },
  {
    file: 'Howell.csv',
    title: 'Howell',
    description: 'Height, weight, age and sex of the !Kung San people, from Nancy Howell’s census.',
    rows: 544,
    columns: 5,
    isDefault: false,
  },
  {
    file: 'ElectricityDemand.csv',
    title: 'Electricity demand',
    description: 'Half-hourly electricity demand in Victoria, Australia, with temperature and holidays, for 2014.',
    rows: 17518,
    columns: 4,
    isDefault: false,
  },
] as const

type Example = (typeof EXAMPLE_DATASETS)[number]

/** The title shown for a loaded file: the example's name, or the file name for anything uploaded. */
export function datasetTitle(filename: string): string {
  return EXAMPLE_DATASETS.find((dataset) => dataset.file === filename)?.title ?? filename
}

/** The example picked last, across every list on the page, and the download it started. */
let latestPick = 0
let pickDownload: AbortController | null = null

/**
 * Fetch an example from /datasets and load it exactly like an uploaded file. Resolves true once it is loaded.
 * The last example picked wins: a small file that downloads quickly must not replace a later pick, so an
 * earlier pick's download is cancelled and its file is never handed to loadFile.
 */
export function useLoadExample() {
  const { loadFile } = useData()
  const [error, setError] = useState<string | null>(null)

  async function load(dataset: Example): Promise<boolean> {
    setError(null)
    const pick = ++latestPick
    pickDownload?.abort()
    const download = new AbortController()
    pickDownload = download
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}datasets/${dataset.file}`, { signal: download.signal })
      if (!response.ok) throw new Error(`status ${response.status}`)
      const text = await response.text()
      if (pick !== latestPick) return false
      const file = new File([text], dataset.file, { type: 'text/csv' })
      return (await loadFile(file, { exampleKey: dataset.file })) !== false
    } catch (cause) {
      if (pick !== latestPick) return false
      setError(`Couldn’t load ${dataset.title} (${cause instanceof Error ? cause.message : String(cause)}).`)
      return false
    } finally {
      if (pickDownload === download) pickDownload = null
    }
  }
  return { load, error }
}

/** The three example datasets as buttons. `current` is the file name of the loaded data, if any. */
export function ExampleList({ current, onLoaded, children }: {
  current?: string
  /** Called after an example has loaded, for the confirming buzz and the focus. */
  onLoaded?: (dataset: Example) => void
  /** More choices at the end of the list, such as "Clear data". */
  children?: React.ReactNode
}) {
  const { load, error } = useLoadExample()
  const { state } = useData()
  // One load at a time: the examples wait while a file is being read and sent.
  const loading = state.status === 'loading'
  return (
    <>
      <ul className="data-examples">
        {EXAMPLE_DATASETS.map((dataset) => (
          <li key={dataset.file}>
            <button type="button" className="data-example" aria-pressed={current === dataset.file} disabled={loading}
              onClick={async () => { if (await load(dataset)) onLoaded?.(dataset) }}>
              <span className="data-example-name">
                {dataset.title}
                {dataset.isDefault && <span className="data-example-default">Default</span>}
              </span>
              <span className="data-example-meta">{dataset.rows.toLocaleString('en-US')} rows × {dataset.columns} columns</span>
              <span className="data-example-desc">{dataset.description}</span>
            </button>
          </li>
        ))}
        {children}
      </ul>
      {error && <p role="alert" className="data-error">{error}</p>}
    </>
  )
}
