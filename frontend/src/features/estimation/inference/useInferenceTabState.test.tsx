import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inferenceApi, type ConfidenceRegionsResponse, type IntervalsResponse } from '../../../api/inference'
import InferenceControls from './InferenceControls'
import InferenceObservation from './InferenceObservation'
import { useInferenceTabState, type InferenceState } from './useInferenceTabState'
import { DEFAULT_SELECTED } from './inferenceOptions'
import { DrawerProvider } from '../../../context/DrawerContext'
import { HISTOGRAM_MARKER, PLOT_COLORS, regionLineColor } from '../../../plot/theme'

function dataFixture() {
  return {
    state: {
      status: 'ready', sessionId: 'session-a', filename: 'ApneaCMKL.csv', dataset: { rows: [] },
      numericCols: ['Breath', 'Age'], filters: {} as Record<string, string[]>, displayPrecision: 3,
    },
    filteredRows: [],
    getNumericData: () => [20, 25, 30, 35, 40],
  }
}
let data = dataFixture()
vi.mock('../../../context/DataContext', () => ({ useData: () => data }))
vi.mock('react-plotly.js', () => ({
  default: ({ data: traces, layout }: { data: unknown[]; layout: unknown }) => <div data-plot={JSON.stringify(traces)} data-layout={JSON.stringify(layout)} />,
}))

function intervals(mean = 30, prediction = false): IntervalsResponse {
  return {
    n: 5, point_estimates: { mean, median: mean, deviation: 8 },
    histogram: { binEdges: [20, 30, 40], counts: [2, 3] },
    table: JSON.stringify([
      { Statistic: 'Mean', Lower: prediction ? 10 : mean - 1, Upper: prediction ? 50 : mean + 1, Method: 't (df=4)', 'Interval Type': prediction ? 'Prediction' : 'Confidence' },
      ...(!prediction ? [{ Statistic: 'Deviation', Lower: 4, Upper: 12, Method: 'Chi-square (s, ddof=1)', 'Interval Type': 'Confidence' }] : []),
    ]),
  }
}
const region: ConfidenceRegionsResponse = {
  z_matrix: [[0.2, 0.4], [0.5, 1]], mu_grid: [25, 35], sigma_grid: [4, 12],
  mu_hat: 30, sigma_hat: 8, mu_ci: [29, 31], sigma_ci: [4, 12], probs: [0.5, 0.95], levels: [0.5, 0.05],
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

let root: Root
let container: HTMLDivElement
let state: InferenceState
function Harness({ controls = true }: { controls?: boolean }) {
  state = useInferenceTabState()
  return <DrawerProvider>
    {controls && <InferenceControls state={state} />}
    <section data-panel="observation"><InferenceObservation state={state} /></section>
  </DrawerProvider>
}
async function render(controls = true) {
  await act(async () => root.render(<Harness controls={controls} />))
}
async function startRun() {
  await act(async () => { void state.handleRun() })
}
function panelText(panel: 'observation') {
  return container.querySelector('[data-panel="' + panel + '"]')!.textContent
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  data = dataFixture()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(inferenceApi, 'getEstimators').mockResolvedValue({ mean_estimators: ['Sample Mean'], deviation_estimators: ['Deviation (1 ddof)', 'MAD'] })
  vi.spyOn(inferenceApi, 'computeCI').mockResolvedValue(intervals())
  vi.spyOn(inferenceApi, 'computePI').mockResolvedValue(intervals(30, true))
  vi.spyOn(inferenceApi, 'computeRegions').mockResolvedValue(region)
  await render()
  // Step gating: nothing is picked for the reader. Picking a variable asks for the first result.
  await act(async () => state.setDraft({ column: 'Breath' }))
})
const openFx = async (label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.lab-fx')].find(item => item.getAttribute('aria-label') === label)!
  await act(async () => button.click())
  return document.querySelector('.lab-popover')!
}
const withBootstrap = (...ids: string[]) => [...DEFAULT_SELECTED, ...ids]
async function pause(ms = 300) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

afterEach(async () => {
  vi.useRealTimers()
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

/** The statistic of a table row, without the small second lines (interval kind, method) that only show in a narrow table. */
const statisticOf = (row: Element) => [...row.children[1].childNodes]
  .filter(node => !(node instanceof HTMLElement && node.classList.contains('lu-sub'))).map(node => node.textContent).join('')

describe('Inference student workflow', () => {
  it('preserves drafts and disclosure state when controls leave and return', async () => {
    await act(async () => state.setDraft({ alphaStr: '0.', ciOpen: true, selected: withBootstrap('ci.mean.boot') }))
    await render(false)
    await render(true)
    expect(state.draft.alphaStr).toBe('0.')
    expect(state.draft.ciOpen).toBe(true)
    expect(state.draft.selected).toContain('ci.mean.boot')
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('Update')
  })

  it('waits for a variable: nothing is requested and the results area says what to do', async () => {
    await act(async () => root.unmount())
    localStorage.clear()
    vi.mocked(inferenceApi.computeCI).mockClear()
    root = createRoot(container)
    await render()
    expect(state.picked).toBe(false)
    expect(inferenceApi.computeCI).not.toHaveBeenCalled()
    expect([...container.querySelectorAll('h2')].map(h => h.textContent).slice(0, 3)).toEqual(['Data', 'What to show (opens after step 1)', 'Settings (opens after step 1)'])
  })

  it('updates on its own after a short pause, and treats zoom/disclosures as display settings', async () => {
    vi.useFakeTimers()
    await act(async () => state.setDraft({ zoomCI: true, ciOpen: true }))
    await pause()
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(1)
    expect(state.isDirty).toBe(false)
    await act(async () => state.setDraft({ alphaStr: '0.1' }))
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(1)
    await pause()
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(2)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ alpha: 0.1 })
    expect(state.isDirty).toBe(false)
    expect(state.appliedConfig?.alpha).toBe(0.1)
    expect(panelText('observation')).toContain('ApneaCMKL.csv · n = 5') // the results heading names the file
    expect(panelText('observation')).not.toContain('Settings changed')
  })

  it('updates bootstrap options on its own too, after a longer pause', async () => {
    vi.useFakeTimers()
    await act(async () => state.setDraft({ selected: withBootstrap('ci.mean.boot') }))
    await pause(300)
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(1) // still waiting: bootstrap is slower
    await pause(500)
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(2)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ bootstrap_mean: true, ci_mean_normal: true })
    await act(async () => state.setDraft({ samplesStr: '2000' }))
    await pause(800)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ bootstrap_samples: 2000 })
    // un-ticking the last bootstrap option returns to the short pause
    await act(async () => state.setDraft({ selected: [...DEFAULT_SELECTED] }))
    await pause(300)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ bootstrap_mean: false })
    expect(container.textContent).not.toContain('Update')
  })

  it('collapses a burst of changes into one request', async () => {
    vi.useFakeTimers()
    for (const alphaStr of ['0.01', '0.02', '0.03', '0.04']) await act(async () => state.setDraft({ alphaStr }))
    await pause()
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(2) // the initial run + one for the whole burst
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ alpha: 0.04 })
  })

  it('rejects invalid fields with associated labels, hints and errors', async () => {
    await act(async () => state.setDraft({ alphaStr: '', selected: withBootstrap('ci.mean.boot'), samplesStr: '2.5' }))
    await startRun()
    expect(inferenceApi.computeCI).toHaveBeenCalledTimes(1)
    // α and the bootstrap count are DualInputs: a slider and a text box each, both flagged
    const invalid = [...container.querySelectorAll<HTMLInputElement>('[aria-invalid="true"]')]
    expect(invalid).toHaveLength(4)
    for (const input of invalid) {
      expect(input.labels?.length || input.getAttribute('aria-labelledby') || input.getAttribute('aria-label')).toBeTruthy()
      const describedBy = input.getAttribute('aria-describedby')!.split(' ')
      expect(describedBy.every(id => document.getElementById(id))).toBe(true)
    }
    expect(document.activeElement).toBe(invalid[0])
  })

  it('allows only the newest request to publish output and loading status', async () => {
    const older = deferred<IntervalsResponse>()
    const newer = deferred<IntervalsResponse>()
    vi.mocked(inferenceApi.computeCI).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await act(async () => state.setDraft({ alphaStr: '0.1' }))
    await startRun()
    await act(async () => state.setDraft({ column: 'Age' }))
    await act(async () => older.reject(new Error('Older failure')))
    expect(state.isComputing).toBe(true)
    expect(state.error).toBeNull()
    await act(async () => newer.resolve(intervals(45)))
    expect(state.ciResult?.point_estimates.mean).toBe(45)
    expect(state.appliedConfig?.column).toBe('Age')
    expect(state.isComputing).toBe(false)
  })

  it('ignores older success after newer output has arrived', async () => {
    const older = deferred<IntervalsResponse>()
    const newer = deferred<IntervalsResponse>()
    vi.mocked(inferenceApi.computeCI).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await startRun()
    await act(async () => state.setDraft({ column: 'Age' }))
    await act(async () => newer.resolve(intervals(45)))
    await act(async () => older.resolve(intervals(20)))
    expect(state.ciResult?.point_estimates.mean).toBe(45)
    expect(state.appliedConfig?.column).toBe('Age')
  })

  it('Reset ignores an in-flight run and calculates the defaults again', async () => {
    const pending = deferred<IntervalsResponse>()
    vi.mocked(inferenceApi.computeCI).mockReturnValueOnce(pending.promise)
    await act(async () => state.setDraft({ alphaStr: '0.1' }))
    await startRun()
    vi.mocked(inferenceApi.computeCI).mockResolvedValue(intervals(45))
    await act(async () => state.handleReset())
    await act(async () => pending.resolve(intervals(20)))
    expect(state.ciResult?.point_estimates.mean).toBe(45)
    expect(state.appliedConfig?.alpha).toBe(0.05)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ alpha: 0.05 })
    expect(state.isComputing).toBe(false)
  })

  it('reruns for changed filters and ignores results from the old dataset', async () => {
    const pending = deferred<IntervalsResponse>()
    vi.mocked(inferenceApi.computeCI).mockReturnValueOnce(pending.promise)
    await startRun()
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filters: { Smoke: ['1'] } } }
    vi.mocked(inferenceApi.computeCI).mockResolvedValue(intervals(36))
    await render()
    await act(async () => pending.resolve(intervals(20)))
    expect(state.ciResult?.point_estimates.mean).toBe(36)
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0]).toMatchObject({ session_id: 'session-b', filters: { Smoke: ['1'] } })
  })

  it.each(['CI', 'PI'] as const)('shows partial results when %s fails, then retries applied settings without losing draft edits', async failed => {
    vi.mocked(failed === 'CI' ? inferenceApi.computeCI : inferenceApi.computePI).mockRejectedValueOnce(new Error('Service unavailable'))
    await startRun()
    expect(state.partialResult).toBe(true)
    expect(failed === 'CI' ? state.ciResult : state.piResult).toBeNull()
    expect(failed === 'CI' ? state.piResult : state.ciResult).not.toBeNull()
    expect(panelText('observation')).toContain('Couldn’t update results')
    expect(panelText('observation')).toContain('Partial result: only the successful intervals are shown.')
    expect(panelText('observation')).toContain(failed === 'CI' ? 'Confidence intervals failed' : 'Prediction intervals failed')
    // Freeze the clock so the automatic update for the edit cannot fire before the checks on a slow run.
    vi.useFakeTimers()
    await act(async () => state.setDraft({ alphaStr: '0.1' }))
    const retry = [...container.querySelectorAll<HTMLButtonElement>('[data-panel="observation"] button')].find(button => button.textContent === 'Retry')!
    await act(async () => retry.click())
    expect(state.error).toBeNull()
    expect(state.partialResult).toBe(false)
    expect(state.ciResult).not.toBeNull()
    expect(state.piResult).not.toBeNull()
    expect(state.appliedConfig?.alpha).toBe(0.05)
    expect(state.draft.alphaStr).toBe('0.1')
    expect(state.isDirty).toBe(true)
  })

  it('shows a shared loading/error state when all requests fail', async () => {
    const ci = deferred<IntervalsResponse>()
    const pi = deferred<IntervalsResponse>()
    vi.mocked(inferenceApi.computeCI).mockReturnValueOnce(ci.promise)
    vi.mocked(inferenceApi.computePI).mockReturnValueOnce(pi.promise)
    await startRun()
    expect(panelText('observation')).toContain('Updating…') // the last result stays on screen, dimmed
    expect(container.querySelector('[data-panel="observation"] table')).not.toBeNull()
    await act(async () => { ci.reject(new Error('CI unavailable')); pi.reject(new Error('PI unavailable')) })
    expect(state.partialResult).toBe(false)
    expect(state.isComputing).toBe(false)
    expect(panelText('observation')).toContain('Couldn’t update results')
    expect(panelText('observation')).toContain('Confidence intervals failed: CI unavailable')
    expect(panelText('observation')).toContain('Prediction intervals failed: PI unavailable')
    expect(panelText('observation')).not.toContain('Choose settings, then select Update')
  })

  it('keeps UI and confidence-region fields out of CI/PI payloads', () => {
    const expected = {
      session_id: 'session-a', column: 'Breath', alpha: 0.05,
      mean_estimator: 'Sample Mean', median_estimator: 'Sample Median', sigma_estimator: 'Deviation (1 ddof)',
      bootstrap_mean: false, bootstrap_median: false, bootstrap_deviation: false, bootstrap_pi: false,
      bootstrap_samples: 1000, ci_mean_normal: true, ci_median_normal: true, ci_deviation_normal: true,
      pi_mean_normal: true, pi_median_normal: true, pi_iqr_normal: true,
      trim_param: null, winsor_limits: null, weights_column: null, filters: null,
    }
    expect(vi.mocked(inferenceApi.computeCI).mock.calls[0][0]).toEqual(expected)
    expect(vi.mocked(inferenceApi.computePI).mock.calls[0][0]).toEqual(expected)
  })

  it('sends per-method flags and only requests the interval families that are ticked', async () => {
    await act(async () => state.setDraft({ selected: withBootstrap('ci.mean.boot', 'pi.boot'), samplesStr: '500' }))
    await startRun()
    const ci = vi.mocked(inferenceApi.computeCI).mock.lastCall![0]
    expect(ci).toMatchObject({ bootstrap_mean: true, bootstrap_pi: true, bootstrap_samples: 500, ci_mean_normal: true, pi_iqr_normal: true })
    // hidden under an unticked parent: ci.mean.normal stays ticked but must not be sent, and no CI request is made
    vi.mocked(inferenceApi.computeCI).mockClear()
    vi.mocked(inferenceApi.computePI).mockClear()
    await act(async () => state.setDraft({ selected: ['ci.mean', 'ci.mean.normal', 'pi', 'pi.normal', 'pi.normal.median'] }))
    await startRun()
    expect(inferenceApi.computeCI).not.toHaveBeenCalled()
    expect(vi.mocked(inferenceApi.computePI).mock.lastCall![0]).toMatchObject({
      ci_mean_normal: false, pi_mean_normal: false, pi_median_normal: true, pi_iqr_normal: false, bootstrap_pi: false,
    })
  })

  it('asks for at least one interval instead of sending an empty request', async () => {
    vi.mocked(inferenceApi.computeCI).mockClear()
    await act(async () => state.setDraft({ selected: [] }))
    await startRun()
    expect(state.fieldErrors.selected).toBe('Tick at least one interval method to calculate.')
    expect(inferenceApi.computeCI).not.toHaveBeenCalled()
  })

  it('sends the deviation estimator only while a normality-based option that uses it is ticked', async () => {
    await act(async () => state.setDraft({ sigmaEst: 'MAD (bias corrected)' }))
    await startRun()
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0].sigma_estimator).toBe('MAD (bias corrected)')
    expect(container.textContent).toContain('σ estimator')
    await act(async () => state.setDraft({ selected: ['ci', 'ci.deviation', 'ci.deviation.boot'] }))
    await startRun()
    expect(vi.mocked(inferenceApi.computeCI).mock.lastCall![0].sigma_estimator).toBe('Deviation (1 ddof)')
    expect(container.textContent).not.toContain('σ estimator')
  })

  it('pins confidence regions to the sample mean and std (ddof=1) whatever else is ticked', async () => {
    await act(async () => state.setDraft({ sigmaEst: 'MAD (bias corrected)', selected: withBootstrap('ci.mean.boot', 'ci.deviation.boot') }))
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions' }))
    expect(vi.mocked(inferenceApi.computeRegions).mock.lastCall![0]).toMatchObject({
      mean_estimator: 'Sample Mean', sigma_estimator: 'Deviation (1 ddof)',
      bootstrap_mean: false, bootstrap_deviation: false, bootstrap_pi: false,
    })
    expect(vi.mocked(inferenceApi.computeRegions).mock.lastCall![0]).not.toHaveProperty('mu_ci_source')
    expect(container.textContent).not.toContain('Using bootstrap')
    expect(container.textContent).not.toContain('Assuming normality')
    expect(container.textContent).not.toContain('σ estimator')
  })

  it('draws a bootstrap row next to the normal row and labels them apart', async () => {
    vi.mocked(inferenceApi.computeCI).mockResolvedValue({
      ...intervals(),
      table: JSON.stringify([
        { Statistic: 'Mean', Lower: 29, Upper: 31, Method: 't (df=4)', 'Interval Type': 'Confidence' },
        { Statistic: 'Mean', Lower: 28, Upper: 32, Method: 'Bootstrap (B=500)', 'Interval Type': 'Confidence' },
      ]),
    })
    await act(async () => state.setDraft({ selected: withBootstrap('ci.mean.boot') }))
    await startRun()
    const meanRows = [...container.querySelectorAll('[data-panel="observation"] tbody tr')].filter(row => statisticOf(row) === 'Mean' || statisticOf(row) === 'Mean – bootstrap')
    expect(meanRows).toHaveLength(2)
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-panel="observation"] tbody button.lab-fx')]
    await act(async () => buttons[2].click()) // the prediction row comes first, then mean t, then mean bootstrap
    expect(document.querySelector('.lab-popover')!.textContent).toContain('Mean · bootstrap')
    await act(async () => buttons[1].click()) // another formula opens: only one at a time
    const popover = document.querySelector('.lab-popover')!
    expect(popover.textContent).toContain('Mean · t')
    expect(popover.textContent).not.toContain('Mean · bootstrap')
    expect(container.querySelector('[data-panel="observation"] tbody')!.textContent).toContain('Bootstrap (B=500)')
    expect(panelText('observation')).not.toContain('Mean – bootstrap:')
  })

  it('names the prediction interval once in the key under the prediction plot, however many bases it has', async () => {
    vi.mocked(inferenceApi.computePI).mockResolvedValue({
      ...intervals(30, true),
      table: JSON.stringify([
        { Statistic: 'Mean', Lower: 10, Upper: 50, Method: 't (df=4)', 'Interval Type': 'Prediction' },
        { Statistic: 'Median', Lower: 11, Upper: 49, Method: 'Normal', 'Interval Type': 'Prediction' },
        { Statistic: 'IQR', Lower: 12, Upper: 48, Method: 'IQR', 'Interval Type': 'Prediction' },
      ]),
    })
    await startRun()
    const keys = [...container.querySelectorAll('[data-panel="observation"] ul.est-legend')]
      .flatMap(list => [...list.querySelectorAll('li')].map(item => item.textContent))
    expect(keys.filter(label => label === 'Prediction interval')).toHaveLength(1)
  })

  it('draws the observed values in the soft histogram look shared by every Statistics tab', async () => {
    await startRun()
    const observed = container.querySelector<HTMLElement>('[data-panel="observation"] [data-plot]')!
    expect(JSON.parse(observed.dataset.plot!)[0].marker).toEqual(HISTOGRAM_MARKER)
  })

  it('puts alpha, the sigma estimator and the bootstrap samples together in one Settings section below the menus', async () => {
    await act(async () => state.setDraft({ selected: withBootstrap('ci.mean.boot') }))
    const text = container.textContent!
    const at = (label: string) => text.indexOf(label)
    expect(at('Settings')).toBeGreaterThan(at('Prediction intervals'))
    expect(at('Significance level α')).toBeGreaterThan(at('Settings'))
    expect(at('σ estimator')).toBeGreaterThan(at('Significance level α'))
    expect(at('Bootstrap samples (B)')).toBeGreaterThan(at('σ estimator'))
  })

  it('keeps alpha for confidence regions in Settings, and only with the marginal box', async () => {
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions', addCiBox: true }))
    const text = container.textContent!
    expect(text.indexOf('Significance level α')).toBeGreaterThan(text.indexOf('Show marginal confidence interval box'))
  })

  it('shows the intervals table at the top, grouped and tinted like the plots', async () => {
    await startRun()
    const observation = container.querySelector('[data-panel="observation"]')!
    const table = observation.querySelector('table')!
    const firstPlot = observation.querySelector('[data-plot]')!
    expect(table.compareDocumentPosition(firstPlot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...table.querySelectorAll('th')].map(cell => cell.textContent))
      .toEqual(['Interval', 'Statistic', 'Method', 'Estimate', 'Lower', 'Upper', 'Lower /Upper', 'Formula'])
    const rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[]
    expect(rows.map(row => row.children[0].textContent)).toEqual(['Prediction', 'Confidence', 'Confidence'])
    expect(rows.map(statisticOf)).toEqual(['Based on the mean', 'Mean', 'Deviation'])
    expect(rows[0].className).toContain('q-prediction')
    expect(rows[1].className).toContain('q-mean')
    expect(rows[2].className).toContain('q-deviation')
    expect(rows.every(row => row.querySelector('button.lab-fx'))).toBe(true)
    expect(rows[1].children[2].textContent).toBe('t (df=4)')
    expect(rows[1].querySelector('.col-lu')!.textContent).toBe('29.00031.000') // stacked Lower and Upper for a narrow table
    expect(rows[1].textContent).toContain('29.000')
    expect(rows[1].textContent).toContain('31.000')
    expect(observation.textContent).toContain('95% coverage')
  })

  it('shares the observed/CI/PI location scale until zoom is explicitly selected', async () => {
    const locationRanges = () => [...container.querySelectorAll<HTMLElement>('[data-layout]')]
      .map(element => JSON.parse(element.dataset.layout!))
      .filter(layout => layout.xaxis.title.text === 'Breath')
      .map(layout => layout.xaxis.range)
    const initial = locationRanges()
    expect(initial).toHaveLength(3)
    expect(initial[0]).toEqual(initial[1])
    expect(initial[1]).toEqual(initial[2])
    expect(initial[0][0]).toBeLessThan(10)
    expect(initial[0][1]).toBeGreaterThan(50)
    const zoom = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Zoom to intervals')!
    await act(async () => zoom.click())
    expect(locationRanges()[2]).not.toEqual(locationRanges()[0])
    expect(panelText('observation')).toContain('Zoomed to confidence intervals — different x-axis scale')
    expect(state.isDirty).toBe(false)
  })

  it('sizes the interval plots margin to their row labels so long ones are not cut', async () => {
    await startRun()
    const layouts = [...container.querySelectorAll<HTMLElement>('[data-layout]')].map(element => JSON.parse(element.dataset.layout!))
    const intervalPlots = layouts.filter(layout => layout.yaxis.ticktext)
    expect(intervalPlots.length).toBeGreaterThan(0)
    for (const layout of intervalPlots) expect(layout.yaxis.automargin).toBe(true)
  })

  it('sets the mean and median plot apart the same way only while it is zoomed', async () => {
    await startRun()
    const location = () => [...container.querySelectorAll('[data-panel="observation"] section')]
      .find(node => node.querySelector('h3')?.textContent?.startsWith('Mean and median confidence intervals'))!
    expect(location().textContent).not.toContain('Different scale')
    const zoom = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Zoom to intervals')!
    await act(async () => zoom.click())
    expect(location().textContent).toContain('Different scale')
  })

  it('sets the deviation plot apart: a Different scale tag and a spread axis title', async () => {
    await startRun()
    const section = [...container.querySelectorAll('[data-panel="observation"] section')]
      .find(node => node.querySelector('h3')?.textContent?.startsWith('Deviation confidence intervals'))!
    expect(section.textContent).toContain('Different scale')
    const layout = JSON.parse(section.querySelector<HTMLElement>('[data-layout]')!.dataset.layout!)
    expect(layout.xaxis.title.text).toBe('Deviation σ of Breath (spread, in data units)')
    expect(layout.xaxis.range).toBeUndefined()
  })

  it('shows the formula of an interval only when its ƒ button is opened, one at a time, with the symbols it uses', async () => {
    await startRun()
    expect(container.querySelector('.katex')).toBeNull() // no formula until asked for
    const labels = ['Formula for confidence interval, mean', 'Formula for confidence interval, deviation', 'Formula for prediction interval, based on the mean']
    const expected = ['Mean · t', 'Deviation · χ²', 'Based on the mean · t']
    for (const [index, label] of labels.entries()) {
      const popover = await openFx(label)
      expect(popover.textContent).toContain(expected[index])
      expect(popover.textContent).toContain('p-quantiles of the standard normal')
      expect(popover.querySelectorAll('.katex').length).toBeGreaterThan(2)
      expect(popover.querySelector('.katex-error')).toBeNull()
      expect(document.querySelectorAll('.lab-popover')).toHaveLength(1)
    }
  })

  it('shows a formula beside each interval option that follows the deviation estimator', async () => {
    const options = () => [...container.querySelectorAll('button.lab-fx')].map(item => item.getAttribute('aria-label'))
    expect(options()).toContain('Formula for confidence interval for the mean, assuming normality')
    expect(options()).toContain('Formula for prediction interval based on the IQR')
    const popover = await openFx('Formula for confidence interval for the mean, assuming normality')
    expect(popover.textContent).toContain('Mean · t')
    await act(async () => state.setDraft({ sigmaEst: 'MAD (bias corrected)' }))
    expect(document.querySelector('.lab-popover')!.textContent).toContain('Mean · normal (z)')
  })

  it('shows alpha in regions only with the CI box, and leaves the plot window to the backend', async () => {
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions' }))
    expect(container.textContent).toContain('Significance level α')
    expect(container.textContent).not.toContain('padding')
    expect(vi.mocked(inferenceApi.computeRegions).mock.lastCall![0]).not.toHaveProperty('eps_mu')
    vi.useFakeTimers()
    await act(async () => state.setDraft({ alphaStr: '', addCiBox: false }))
    await pause()
    expect(container.textContent).not.toContain('Significance level α')
    expect(state.fieldErrors).toEqual({}) // a hidden, empty alpha does not block the regions
    expect(vi.mocked(inferenceApi.computeRegions).mock.lastCall![0]).toMatchObject({ alpha: 0.05, add_ci_box: false })
  })

  it('honors applied region-box settings and shows coverage as percentages', async () => {
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions', addCiBox: false, crProbs: '0.5, 0.95' }))
    expect(vi.mocked(inferenceApi.computeRegions).mock.lastCall![0]).toMatchObject({ probs: [0.5, 0.95], add_ci_box: false })
    const traces = () => JSON.parse(container.querySelector<HTMLElement>('[data-plot]')!.dataset.plot!) as { name: string }[]
    expect(traces().some(trace => trace.name === 'Separate marginal intervals')).toBe(false)
    expect(panelText('observation')).toContain('Cut-off for 50% coverage0.500')
    expect(panelText('observation')).toContain('Cut-off for 95% coverage0.050')
    expect(panelText('observation')).not.toContain('Mean interval (box)')
    vi.useFakeTimers()
    await act(async () => state.setDraft({ addCiBox: true }))
    expect(traces().some(trace => trace.name === 'Separate marginal intervals')).toBe(false)
    await pause()
    expect(traces().some(trace => trace.name === 'Separate marginal intervals')).toBe(true)
    expect(panelText('observation')).toContain('Mean interval (box)29.000 to 31.000')
    expect((await openFx('Formula for confidence regions')).textContent).toContain('Marginal box (dashed, not a joint region)')
  })

  it('draws the regions as white lines labeled by coverage, with no outlier red on the plot', async () => {
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions', addCiBox: true, crProbs: '0.5, 0.95' }))
    await act(async () => { await vi.waitFor(() => expect(container.querySelector('[data-plot]')).not.toBeNull()) })
    const element = container.querySelector<HTMLElement>('[data-plot]')!
    const traces = JSON.parse(element.dataset.plot!) as Record<string, any>[]
    const layout = JSON.parse(element.dataset.layout!) as Record<string, any>
    const contours = traces.filter(trace => trace.type === 'contour')
    expect(contours).toHaveLength(2)
    // 'lines' would color each line from a color scale and ignore line.color.
    expect(contours.every(trace => trace.contours.coloring === 'none')).toBe(true)
    expect(contours.map(trace => trace.line.color)).toEqual([regionLineColor(0, 2), regionLineColor(1, 2)])
    expect(regionLineColor(0, 2)).not.toBe(regionLineColor(1, 2))
    expect(layout.annotations.map((note: { text: string }) => note.text)).toEqual(['50%', '95%'])
    expect(JSON.stringify(traces)).not.toContain(PLOT_COLORS.outlier)
    expect(traces.find(trace => trace.name === 'Estimated mean and deviation')!.marker.color).toBe(PLOT_COLORS.regionEstimate)
    const box = traces.find(trace => trace.name === 'Separate marginal intervals')!
    expect(box.line).toMatchObject({ color: PLOT_COLORS.regionBox, dash: 'dash' })
  })

  it('gives the region values in a table first, and explains how the regions are built behind the ƒ button', async () => {
    await act(async () => state.setDraft({ estimationType: 'Confidence Regions', addCiBox: false }))
    await act(async () => { await vi.waitFor(() => expect(state.regionResult).not.toBeNull()) })
    const observation = container.querySelector('[data-panel="observation"]')!
    expect([...observation.querySelectorAll('h3')].map(node => node.textContent)).toEqual(['Values', 'Joint confidence regions'])
    const rows = [...observation.querySelectorAll('tbody tr')]
    expect(rows[0].textContent).toContain('30.000')
    expect(rows[0].querySelector('.katex')).not.toBeNull()
    expect(rows[1].textContent).toContain('8.000')
    expect(observation.textContent).not.toMatch(/[μσ]\u0302/)
    const popover = await openFx('Formula for confidence regions')
    for (const label of ['Normal likelihood', 'Maximum-likelihood estimates (the deviation divides by n)', 'Relative likelihood', 'Region with coverage p']) {
      expect(popover.textContent).toContain(label)
    }
    expect(popover.textContent).not.toContain('Marginal box') // the box is off
    expect(popover.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(4)
    expect(popover.querySelector('.katex-error')).toBeNull()
  })
})

describe('Inference follows the interaction contract', () => {
  it('Estimate is a radio group', () => {
    const radios = [...container.querySelectorAll<HTMLInputElement>('form input[type="radio"]')]
    expect(radios.map(radio => radio.closest('label')!.textContent)).toEqual(['Intervals', 'Confidence regions'])
    expect(new Set(radios.map(radio => radio.name)).size).toBe(1)
  })

  it('has no explanatory prose in the panels', async () => {
    await startRun()
    expect(container.querySelector('form')!.textContent).not.toContain('A confidence interval describes')
    expect(container.querySelector('form')!.textContent).not.toContain('no correction across rows')
    expect(panelText('observation')).not.toContain('Lines show interval bounds')
  })

  it('reports a failed update in the results area, with Retry', async () => {
    // Every CI call fails, so an automatic update that starts before the explicit run cannot use up the failure.
    vi.mocked(inferenceApi.computeCI).mockRejectedValue(new Error('Service unavailable'))
    await act(async () => state.setDraft({ alphaStr: '0.1' }))
    await startRun()
    expect(panelText('observation')).toContain('Couldn’t update results')
    expect(container.querySelector('form')!.textContent).not.toContain('Couldn’t update results')
  })

  it('an estimator load failure is a warning above the results, not in the controls', async () => {
    await act(async () => root.unmount())
    root = createRoot(container)
    vi.mocked(inferenceApi.getEstimators).mockRejectedValue(new Error('offline'))
    await render()
    await startRun()
    expect(container.querySelector('[data-panel="observation"] [aria-label="Warnings"]')?.textContent).toContain('Estimator options could not be loaded')
    expect(container.querySelector('form')!.textContent).not.toContain('Estimator options could not be loaded')
  })

  it('does not ask the estimator list about a variable that only the previous dataset has', async () => {
    await render()
    vi.mocked(inferenceApi.getEstimators).mockClear()
    // Another dataset arrives (new session and file, no column "Breath") before the draft has been cleared.
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'Other.csv', numericCols: ['Weight'] } }
    await render()
    expect(inferenceApi.getEstimators).not.toHaveBeenCalledWith(expect.objectContaining({ session_id: 'session-b', column: 'Breath' }))
  })

  it('the zoom note is a muted section note', async () => {
    await act(async () => state.setDraft({ zoomCI: true }))
    await startRun()
    const note = [...container.querySelectorAll('[data-panel="observation"] p')].find(p => p.textContent?.startsWith('Zoomed'))!
    expect(note.className).not.toContain('amber')
  })
})
