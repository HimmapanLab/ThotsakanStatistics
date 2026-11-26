import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { graphicalApi, type GraphicalResponse } from '../../../api/graphical'
import { inferenceApi } from '../../../api/inference'
import { useGraphicalTabState, type GraphicalTabState } from './useGraphicalTabState'
import { ControlsSlot, ObservationSlot } from './GraphicalTab'
import { DrawerProvider } from '../../../context/DrawerContext'

function dataFixture() {
  return { state: {
    status: 'ready', sessionId: 'session-a', filename: 'sample.csv', dataset: { rows: [] },
    numericCols: ['Age', 'Weight'], filters: {} as Record<string, string[]>, displayPrecision: 3,
  }, filteredRows: [] }
}
let data = dataFixture()
vi.mock('../../../context/DataContext', () => ({ useData: () => data }))
vi.mock('plotly.js-basic-dist-min', () => ({ default: {} }))
vi.mock('react-plotly.js/factory', () => ({ default: () => () => <div data-testid="plot" /> }))

function response(n = 10, warnings: string[] = []): GraphicalResponse {
  return { summary: { n, n_unique: n }, histogram_data: { bins: [0, 1, 2], counts: [4, 6], densities: [0.4, 0.6] }, warnings }
}
function pending() {
  let resolve!: (result: GraphicalResponse) => void
  let reject!: (error: Error) => void
  const promise = new Promise<GraphicalResponse>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

let root: Root
let container: HTMLDivElement
let state: GraphicalTabState
function Harness({ controls = true }: { controls?: boolean }) {
  state = useGraphicalTabState()
  return <DrawerProvider>
    {controls && <ControlsSlot state={state} />}
    <section aria-label="Observation"><ObservationSlot state={state} /></section>
  </DrawerProvider>
}
async function render(controls = true) {
  await act(async () => root.render(<Harness controls={controls} />))
}
async function advance(ms = 250) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}
const calls = () => vi.mocked(graphicalApi.computeGraph).mock.calls
const lastParams = () => vi.mocked(graphicalApi.computeGraph).mock.lastCall![1]
function panel(name: 'Observation') {
  return container.querySelector(`section[aria-label="${name}"]`)!
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers()
  data = dataFixture()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(graphicalApi, 'computeGraph').mockResolvedValue(response())
  vi.spyOn(inferenceApi, 'getEstimators').mockResolvedValue({
    mean_estimators: ['Sample Mean', 'Trimmed Mean', 'Winsorized Mean', 'Weighted Mean'],
    deviation_estimators: ['Deviation (1 ddof)', 'MAD (bias corrected)'],
  })
  await render()
  // Step gating: nothing is picked for the reader, so every test starts by picking a variable.
  await act(async () => state.updateConfig('column', 'Age'))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Graphical: every setting updates the plot on its own', () => {
  it('waits for a variable: nothing is requested and the results area says what to do', async () => {
    await act(async () => state.updateConfig('column', ''))
    await advance(1000)
    expect(calls()).toHaveLength(0)
    expect(panel('Observation').textContent).toContain('Pick a variable to start')
  })

  it('draws the base graph once a variable is picked, with no Run or Update button anywhere', async () => {
    await advance()
    expect(calls()).toHaveLength(1)
    expect(state.result?.summary.n).toBe(10)
    const buttons = [...container.querySelectorAll('button')].map(button => button.textContent)
    expect(buttons.join(' ')).not.toMatch(/Run|Update/)
    expect(container.textContent).not.toContain('press Run')
  })

  it('applies a normal overlay with its estimators automatically, after one pause', async () => {
    await advance()
    await act(async () => {
      state.updateConfig('addNormal', true)
      state.updateConfig('muEstimator', 'Sample Median')
      state.updateConfig('sigmaEstimator', 'MAD (bias corrected)')
    })
    expect(calls()).toHaveLength(1) // not before the pause
    await advance()
    expect(calls()).toHaveLength(2) // one request for the whole burst
    expect(lastParams()).toMatchObject({ add_normal: true, mu_estimator: 'Sample Median', sigma_estimator: 'MAD (bias corrected)' })
  })

  it('offers the sample median beside the mean estimators for mu', async () => {
    await advance()
    expect(state.muEstimators).toEqual(['Sample Mean', 'Sample Median', 'Trimmed Mean', 'Winsorized Mean', 'Weighted Mean'])
  })

  it('asks again for the ECDF band when alpha changes', async () => {
    await advance()
    await act(async () => state.updateConfig('graphType', 'ECDF'))
    await advance()
    await act(async () => state.updateConfig('alpha', 0.1))
    await advance()
    expect(lastParams()).toMatchObject({ graph_type: 'ECDF', add_conf_band: true, alpha: 0.1 })
  })

  it('does not ask again for a change that cannot affect the plot on screen', async () => {
    await advance()
    await act(async () => state.updateConfig('addNormal', false))
    await act(async () => state.updateConfig('graphType', 'ECDF'))
    await advance()
    const before = calls().length
    // none of these exist on the ECDF view, and the normal overlay is off
    await act(async () => {
      state.updateConfig('addKde', false)
      state.updateConfig('bins', 40)
      state.updateConfig('muEstimator', 'Sample Median')
    })
    await advance(1000)
    expect(calls()).toHaveLength(before)
  })

  it('never sends a KDE flag from the ECDF view, so no "KDE is not drawn" notice can appear', async () => {
    await advance()
    await act(async () => state.updateConfig('graphType', 'ECDF'))
    await advance()
    expect(lastParams()).toMatchObject({ graph_type: 'ECDF', add_kde: false })
  })

  it('keeps setup and incomplete winsor input across controls unmounts', async () => {
    await act(async () => {
      state.updateConfig('addNormal', true)
      state.updateConfig('muEstimator', 'Winsorized Mean')
      state.setWinsorRaw('0.1,')
      state.setAutoBins(false)
    })
    await render(false)
    await render(true)
    expect(state.cfg.muEstimator).toBe('Winsorized Mean')
    expect(state.winsorRaw).toBe('0.1,')
    expect(state.autoBins).toBe(false)
    expect(state.cfg.bins).toBe(20)
  })

  it('sends nothing for an incomplete draft, keeps the previous plot and flags the field', async () => {
    await advance()
    await act(async () => {
      state.updateConfig('addNormal', true)
      state.updateConfig('muEstimator', 'Winsorized Mean')
      state.setWinsorRaw('0.1,')
    })
    await advance(1000)
    expect(calls()).toHaveLength(1)
    expect(state.result?.summary.n).toBe(10)
    const invalid = container.querySelector<HTMLInputElement>('input[aria-invalid="true"]')!
    expect(invalid.value).toBe('0.1,')
    expect(document.activeElement).toBe(invalid)
    expect(invalid.getAttribute('aria-describedby')).toContain('-error')
    // completing the input resumes automatic updates
    await act(async () => state.setWinsorRaw('0.1, 0.2'))
    await advance()
    expect(lastParams()).toMatchObject({ add_normal: true, mu_estimator: 'Winsorized Mean', winsor_limits: '0.1, 0.2' })
  })

  it('shows no variable error without a dataset, as the other tabs', async () => {
    await act(async () => root.unmount())
    data = { ...data, state: { ...data.state, status: 'idle', sessionId: null as unknown as string, filename: '', numericCols: [] } }
    root = createRoot(container)
    await render()
    expect(container.textContent).not.toContain('Select a numeric column')
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull()
  })
})

describe('Graphical: result ownership', () => {
  it('accepts only the newest completion and ignores older failures during loading', async () => {
    const older = pending()
    const newer = pending()
    vi.mocked(graphicalApi.computeGraph).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await advance()
    await act(async () => state.updateConfig('column', 'Weight'))
    await advance()
    await act(async () => older.reject(new Error('Old failure')))
    expect(state.error).toBeNull()
    expect(state.isComputing).toBe(true)
    await act(async () => newer.resolve(response(20)))
    expect(state.result?.summary.n).toBe(20)
    expect(state.column).toBe('Weight')
    expect(state.isComputing).toBe(false)
  })

  it('ignores an older success after a newer result is displayed', async () => {
    const older = pending()
    const newer = pending()
    vi.mocked(graphicalApi.computeGraph).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await advance()
    await act(async () => state.updateConfig('column', 'Weight'))
    await advance()
    await act(async () => newer.resolve(response(20)))
    await act(async () => older.resolve(response(5)))
    expect(state.result?.summary.n).toBe(20)
    expect(state.column).toBe('Weight')
  })

  it('invalidates a pending response on Reset and draws a fresh base graph', async () => {
    const request = pending()
    vi.mocked(graphicalApi.computeGraph).mockReturnValueOnce(request.promise)
    await advance()
    await act(async () => {
      state.updateConfig('addNormal', false)
      state.reset()
    })
    await act(async () => request.resolve(response(99)))
    expect(state.result).toBeNull()
    expect(state.cfg.addNormal).toBe(true) // the page opens with the Normal model on
    await advance()
    expect(state.result?.summary.n).toBe(10)
  })

  it('invalidates filter requests and clears old results/drafts for a new dataset', async () => {
    const request = pending()
    vi.mocked(graphicalApi.computeGraph).mockReturnValueOnce(request.promise)
    await advance()
    data = { ...data, state: { ...data.state, filters: { Site: ['A'] } } }
    await render()
    await act(async () => request.resolve(response(99)))
    expect(state.result).toBeNull()
    await advance()
    expect(lastParams().filters).toEqual({ Site: ['A'] })
    await act(async () => state.updateConfig('addNormal', false))
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'other.csv', numericCols: ['Score'] } }
    await render()
    expect(state.result).toBeNull()
    expect(state.cfg.column).toBe('') // another dataset starts with nothing picked
    expect(state.cfg.addNormal).toBe(true) // and with the defaults
  })

  it('shows shared failure/retry status and retains the previous result', async () => {
    await advance()
    vi.mocked(graphicalApi.computeGraph).mockRejectedValueOnce(new Error('Service unavailable'))
    await act(async () => state.updateConfig('addNormal', false))
    await advance()
    const text = panel('Observation').textContent!
    expect(text).toContain('Couldn’t update results')
    expect(text).toContain('The result below is the previous one.')
    expect(panel('Observation').querySelector('[data-testid="plot"]')).not.toBeNull() // the last result stays on screen
    expect([...panel('Observation').querySelectorAll('button')].map(button => button.textContent)).toContain('Retry')
    await act(async () => state.retry())
    expect(state.error).toBeNull()
    expect(lastParams().add_normal).toBe(false)
  })

  it('gives an initial failure a Retry without contradictory empty guidance', async () => {
    vi.mocked(graphicalApi.computeGraph).mockRejectedValueOnce(new Error('Unavailable'))
    await act(async () => state.updateConfig('column', 'Weight'))
    await advance()
    expect(panel('Observation').textContent).toContain('Couldn’t update results')
    expect(panel('Observation').textContent).not.toContain('Pick a variable')
    await act(async () => state.retry())
    expect(state.result).not.toBeNull()
  })
})

describe('Graphical: warnings, formulas and results', () => {
  const openFx = async (label: string) => {
    const button = [...container.querySelectorAll<HTMLButtonElement>('button.lab-fx')].find(item => item.getAttribute('aria-label') === label)!
    await act(async () => button.click())
    return document.querySelector('.lab-popover')!
  }
  const headings = () => [...panel('Observation').querySelectorAll('h3')].map(node => node.textContent)

  it('shows backend warnings with the plot, once', async () => {
    vi.mocked(graphicalApi.computeGraph).mockResolvedValue(response(10, ['KDE not drawn: every observation has the same value.']))
    await act(async () => state.updateConfig('column', 'Weight'))
    await advance()
    expect(panel('Observation').textContent!.match(/KDE not drawn/g)).toHaveLength(1)
  })

  it('shows the estimator notice as a warning with the results, not in the left panel', async () => {
    await act(async () => root.unmount())
    container.remove()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.mocked(inferenceApi.getEstimators).mockRejectedValue(new Error('Unavailable'))
    await render()
    await act(async () => state.updateConfig('column', 'Age'))
    await advance()
    const warnings = panel('Observation').querySelector('[aria-label="Warnings"]')
    expect(warnings?.textContent).toContain('Estimator choices could not load')
    expect(container.textContent!.match(/Estimator choices could not load/g)).toHaveLength(1)
  })

  it('offers the histogram and the ECDF named in full, a KDE named in full, and no rug or PMF', async () => {
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map(radio => radio.closest('label')!.textContent)).toEqual(['Histogram', 'ECDF (empirical cumulative distribution function)'])
    expect(container.textContent).toContain('KDE (kernel density estimator)')
    expect(container.textContent).not.toMatch(/Show data|rug|PMF/)
  })

  it('sets the KDE bandwidth with a slider under the KDE, from a fifth to five times the default', async () => {
    vi.mocked(graphicalApi.computeGraph).mockResolvedValue({ ...response(), kde_curve: { x: [0, 1], y: [1, 1], bandwidth: 2, default_bandwidth: 2 } })
    await advance()
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(slider.closest('div')!.parentElement!.textContent).toContain('Bandwidth h')
    expect([Number(slider.min), Number(slider.max), Number(slider.value)]).toEqual([0.4, 10, 2])
    await act(async () => state.updateConfig('kdeBandwidth', 3))
    await advance()
    expect(lastParams()).toMatchObject({ add_kde: true, kde_bandwidth: 3 })
    await act(async () => state.updateConfig('addKde', false))
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })

  it('lists the bandwidth in use and its default rule in a table, before the plot, each with its own formula', async () => {
    vi.mocked(graphicalApi.computeGraph).mockResolvedValue({ ...response(), kde_curve: { x: [0, 1], y: [1, 1], bandwidth: 1.5, default_bandwidth: 2 } })
    await advance()
    expect(headings()).toEqual(['Values', 'Histogram'])
    const table = panel('Observation').querySelector('table')!
    expect(table.textContent).toContain('1.500')
    expect(table.textContent).toContain('2.000')
    expect(table.textContent).toContain('Scott')
    const popover = await openFx('Formula for Scott’s rule bandwidth')
    expect(popover.textContent).toContain('sample standard deviation')
    expect(popover.querySelector('.katex-error')).toBeNull()
  })

  it('says when whole numbers were given one bar each', async () => {
    vi.mocked(graphicalApi.computeGraph).mockResolvedValue({ ...response(), histogram_data: { bins: [0.5, 1.5, 2.5], counts: [4, 6], densities: [0.4, 0.6], unit_width: true } })
    await act(async () => state.updateConfig('column', 'Weight'))
    await advance()
    expect(panel('Observation').textContent).toContain('one bar of width 1 per whole number')
  })

  it('uses the shared option group for the plot type and keeps no applied-settings text', async () => {
    const legend = Array.from(container.querySelectorAll('legend')).find((element) => element.textContent === 'Plot type')
    expect(legend).toBeDefined()
    expect('appliedSettings' in state).toBe(false)
  })

  it('typesets the normal-overlay estimates instead of combining-hat characters', async () => {
    vi.mocked(graphicalApi.computeGraph).mockResolvedValue({ ...response(), normal_curve: { x: [0, 1], y: [1, 1], mu: 1, sigma: 2 }, point_estimates: { mu: 1, sigma: 2 } })
    await act(async () => state.updateConfig('addNormal', true))
    await advance()
    const table = panel('Observation').querySelector('table')!
    expect(table.textContent).not.toMatch(/[μσ]\u0302/)
    expect(table.querySelectorAll('td:first-child .katex')).toHaveLength(2)
  })

  it('shows a formula only when its ƒ button is opened, and only the one beside the option', async () => {
    expect(container.querySelector('.katex')).toBeNull()
    const popover = await openFx('Formula for Histogram')
    expect(popover.textContent).toContain('Bar areas sum to 1')
    expect(popover.querySelectorAll('.katex').length).toBeGreaterThan(0)
    expect(popover.querySelector('.katex-error')).toBeNull()
    expect(popover.textContent).not.toContain('Empirical CDF')
  })

  it('shows the ECDF definition and the DKW band formula, and the normal model in its cumulative form, with the ECDF on', async () => {
    await act(async () => state.updateConfig('graphType', 'ECDF'))
    const ecdf = await openFx('Formula for ECDF')
    expect(ecdf.textContent).toContain('Proportion of observations at or below x')
    const band = await openFx('Formula for Confidence band')
    expect(band.textContent).toContain('expected to contain the true distribution function')
    const normal = await openFx('Formula for Normal model')
    expect(normal.textContent).toContain('cumulative')
    expect(normal.textContent).not.toContain('drawn as the density')
    expect(document.querySelector('.katex-error')).toBeNull()
  })

  it('keeps the options of a plot type that is not drawn greyed out with the reason, and no formula button for them', async () => {
    expect(container.textContent).toContain('ECDF only.')
    expect([...container.querySelectorAll('button.lab-fx')].map(item => item.getAttribute('aria-label'))).not.toContain('Formula for Confidence band')
  })
})
