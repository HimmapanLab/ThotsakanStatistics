import { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXAMPLE_DATASETS, ExampleList } from './ExampleDatasets'

const loadFile = vi.fn()
let status = 'idle'
vi.mock('../../context/DataContext', () => ({ useData: () => ({ loadFile, state: { status } }) }))

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  loadFile.mockReset()
  status = 'idle'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<ExampleList />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function button(name: string) {
  return Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.includes(name))!
}

describe('Example datasets', () => {
  it('lists the three datasets, WHR first as the default', async () => {
    const items = Array.from(container.querySelectorAll('li')).map((item) => item.textContent)
    expect(items).toHaveLength(3)
    expect(items[0]).toContain('World Happiness Report')
    expect(items[0]).toContain('Default')
    expect(items[1]).toContain('Howell')
    expect(items[2]).toContain('Electricity demand')
  })

  it('loads a picked dataset through the same path as an upload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('height,weight\n150,47\n'))
    vi.stubGlobal('fetch', fetchMock)
    await act(async () => button('Howell').click())
    expect(fetchMock.mock.calls[0][0]).toBe('/datasets/Howell.csv')
    const file = loadFile.mock.calls[0][0] as File
    expect(file.name).toBe('Howell.csv')
    expect(await file.text()).toBe('height,weight\n150,47\n')
  })

  it('the example picked last wins, even when an earlier pick downloads more slowly', async () => {
    // Electricity is picked first but its download finishes after Howell's, as a 17,518-row file would.
    let finishElectricity!: (response: Response) => void
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('ElectricityDemand.csv')) {
        return new Promise<Response>((resolve, reject) => {
          finishElectricity = resolve
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      }
      return Promise.resolve(new Response('height,weight\n150,47\n'))
    })
    vi.stubGlobal('fetch', fetchMock)
    loadFile.mockResolvedValue(true)
    await act(async () => button('Electricity').click())
    await act(async () => button('Howell').click())
    await act(async () => finishElectricity(new Response('ds,Demand\n2014-01-01,4091\n')))
    expect(loadFile).toHaveBeenCalledTimes(1)
    expect((loadFile.mock.calls[0][0] as File).name).toBe('Howell.csv')
    // The earlier download was cancelled, and its failure is not shown as an error.
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
    expect(container.textContent).not.toContain('Couldn’t load')
  })

  it('waits while another file is loading, so two clicks cannot race', async () => {
    status = 'loading'
    await act(async () => root.render(<ExampleList />))
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button.data-example'))
    expect(buttons).toHaveLength(3)
    expect(buttons.every((b) => b.disabled)).toBe(true)
    status = 'ready'
    await act(async () => root.render(<ExampleList />))
    expect(container.querySelectorAll<HTMLButtonElement>('button.data-example:disabled')).toHaveLength(0)
  })

  it('says so when a dataset cannot be fetched, and loads nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    await act(async () => button('Howell').click())
    expect(loadFile).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Howell')
  })

  it('ships every listed file, with the rows and columns the list shows', () => {
    for (const dataset of EXAMPLE_DATASETS) {
      const lines = readFileSync(`public/datasets/${dataset.file}`, 'utf-8').trim().split(/\r?\n/)
      expect(lines.length - 1, dataset.file).toBe(dataset.rows)
      expect(lines[0].split(',').length, dataset.file).toBe(dataset.columns)
    }
  })
})
