import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DistParams, DistResult } from '../../../hooks/useDistribution'
import type { DistQuery } from '../../../math/probabilityQuery'

vi.mock('react-plotly.js/factory', () => ({ default: () => () => null }))
vi.mock('plotly.js-basic-dist-min', () => ({ default: {} }))
import CommonDistObservation from './CommonDistObservation'
import CommonDistControls from './CommonDistControls'
import katex from 'katex'
import { DIST_FORMULAS } from './distributionFormulas'
import { DISTRIBUTIONS } from '../../../hooks/useDistribution'

const params: DistParams = { distName: 'Poisson', paramValues: { lambda: 5 }, query: { kind: 'one-sided', op: '<=', k: 5 } }
const result: DistResult = {
  ks: [0, 1], probs: [0.5, 0.5], cumProbs: [0.5, 1], queryResult: 0.61596, theorMean: 1.23456, theorVariance: 5,
  provisional: false, requestFingerprint: '',
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

/** Renders the left panel; with `track`, the query follows onQueryChange like App does. */
function renderControls(query: DistQuery, track = false, distName = 'Poisson', paramValues: Record<string, number> = { lambda: 5 }) {
  const onQueryChange = vi.fn()
  function Harness() {
    const [current, setCurrent] = useState(query)
    return <CommonDistControls modelType="discrete" distName={distName} paramValues={paramValues} query={track ? current : query}
      onModelTypeChange={() => {}} onDistChange={() => {}} onParamChange={() => {}}
      onQueryChange={(next) => { onQueryChange(next); setCurrent(next) }} onReset={() => {}} />
  }
  act(() => root.render(<Harness />))
  return onQueryChange
}
const radio = (label: string) => [...container.querySelectorAll('label')].find((item) => item.textContent === label)!.querySelector('input')!
const input = (label: string) => container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement
function type(label: string, value: string) {
  const field = input(label)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setter.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
}

describe('Probability panels', () => {
  it('shows the shared error box with Retry when the request fails', () => {
    const onRetry = vi.fn()
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={null} result={result} isLoading={false}
      error="boom" onRetry={onRetry} precision={3} />))
    expect(container.textContent).toContain('Couldn’t update results')
    expect(container.textContent).toContain('boom')
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Retry')!.click())
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('numbers follow display precision', () => {
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={params} result={result} isLoading={false}
      error={null} onRetry={() => {}} precision={2} />))
    expect(container.textContent).toContain('1.23')
    expect(container.textContent).not.toContain('1.235')
    expect(container.textContent).toContain('0.62')
  })

  it('left panel holds no result', () => {
    renderControls(params.query)
    expect(container.textContent).not.toContain('P(X')
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(4) // model type, query type
  })

  it('Hypergeometric mean and variance put each factor in parentheses', () => {
    expect(DIST_FORMULAS.Hypergeometric.mean).toContain(String.raw`n \left( \frac{K}{N} \right)`)
    expect(DIST_FORMULAS.Hypergeometric.variance).toContain(String.raw`\left( \frac{N - n}{N - 1} \right)`)
  })

  it('the mean card is called Mean', () => {
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={params} result={result} isLoading={false}
      error={null} onRetry={() => {}} precision={2} />))
    expect(container.textContent).toContain('Mean')
    expect(container.textContent).not.toContain('Theoretical')
  })

  it('switching to Interval starts one standard deviation around the mean', () => {
    const onQueryChange = renderControls(params.query)
    act(() => radio('Interval').click())
    // Poisson(5): mean 5, sd √5 ≈ 2.24 → 3 and 7
    expect(onQueryChange).toHaveBeenLastCalledWith({ kind: 'interval', lower: 3, lowerOp: '<', upper: 7, upperOp: '<=' })
  })

  it('the interval reads x₁ [op] X [op] x₂ in one row, with a two-handle slider', () => {
    renderControls({ kind: 'interval', lower: 2, lowerOp: '<', upper: 5, upperOp: '<=' })
    const row = input('Lower value (x₁)').parentElement!
    expect([...row.children].map((child) => child.getAttribute('aria-label') ?? child.textContent))
      .toEqual(['Lower value (x₁)', 'Lower inequality', 'X', 'Upper inequality', 'Upper value (x₂)'])
    expect(['x₁', 'x₂'].map((label) => input(label)?.type)).toEqual(['range', 'range'])
  })

  it('slider handles cannot cross', () => {
    const onQueryChange = renderControls({ kind: 'interval', lower: 2, lowerOp: '<', upper: 5, upperOp: '<=' })
    type('x₁', '8')
    expect(onQueryChange).toHaveBeenLastCalledWith({ kind: 'interval', lower: 5, lowerOp: '<', upper: 5, upperOp: '<=' })
    type('x₂', '1')
    expect(onQueryChange).toHaveBeenLastCalledWith({ kind: 'interval', lower: 2, lowerOp: '<', upper: 2, upperOp: '<=' })
  })

  it('values outside the support are rejected, e.g. above 1 for a Beta', () => {
    const onQueryChange = renderControls({ kind: 'one-sided', op: '<=', k: 0.3 }, false, 'Beta', { alpha: 2, beta: 5 })
    const slider = container.querySelector('[aria-label="x"]') as HTMLInputElement
    expect([slider.min, slider.max]).toEqual(['0', '1'])
    type('Value (x)', '1.5')
    expect(container.textContent).toContain('Enter a value between 0 and 1.')
    expect(onQueryChange).not.toHaveBeenCalled()
  })

  it('a Hypergeometric K and n slider ends at N', () => {
    renderControls(params.query, false, 'Hypergeometric', { N: 30, K: 20, n: 10 })
    const sliders = [...container.querySelectorAll('input[type="range"]')] as HTMLInputElement[]
    expect(sliders.slice(0, 3).map((slider) => slider.max)).toEqual(['100', '30', '30'])
  })

  it('an interval with x₁ greater than x₂ shows an error and keeps the last valid query', () => {
    const onQueryChange = renderControls({ kind: 'interval', lower: 2, lowerOp: '<', upper: 5, upperOp: '<=' })
    type('Upper value (x₂)', '1')
    expect(container.textContent).toContain('x₂ must not be less than x₁.')
    expect(onQueryChange).not.toHaveBeenCalled()
    type('Upper value (x₂)', '6')
    expect(container.textContent).not.toContain('must not be less than')
    expect(onQueryChange).toHaveBeenLastCalledWith({ kind: 'interval', lower: 2, lowerOp: '<', upper: 6, upperOp: '<=' })
  })

  it('typing keeps unfinished text such as "1.0" on the way to 1.05', () => {
    renderControls(params.query, true)
    type('Value (x)', '1.0')
    expect(input('Value (x)').value).toBe('1.0')
  })

  it('every distribution has formulas that KaTeX can typeset', () => {
    for (const dist of DISTRIBUTIONS) {
      const formulas = DIST_FORMULAS[dist.name]
      expect(formulas, dist.name).toBeDefined()
      expect(formulas.description, dist.name).not.toBe('')
      for (const param of formulas.parameters) expect(param.meaning, dist.name).not.toBe('')
      for (const tex of [formulas.density, formulas.support, ...formulas.parameters.map((param) => param.tex), formulas.mean, formulas.variance]) {
        expect(() => katex.renderToString(tex, { throwOnError: true }), `${dist.name}: ${tex}`).not.toThrow()
      }
    }
  })

  it('the three steps are all open from the start and named', () => {
    renderControls(params.query)
    const titles = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
    expect(titles).toEqual(['Distribution', 'Parameters', 'Query'])
    expect(container.querySelectorAll('.is-locked')).toHaveLength(0)
  })

  it('every step has an ƒ button that opens only its own formula, typeset', () => {
    renderControls(params.query)
    const fx = [...container.querySelectorAll('button.lab-fx')] as HTMLButtonElement[]
    expect(fx.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Formula for Poisson distribution', 'Formula for Poisson: parameters', 'Formula for probability query',
    ])
    act(() => fx[1].click())
    const pop = document.body.querySelector('.lab-popover')!
    expect(pop.querySelectorAll('.katex').length).toBe(1)
    expect(pop.textContent).toContain('rate: mean number of events per interval')
    expect(pop.textContent).not.toContain('Poisson distribution')
    act(() => fx[2].click())
    expect(document.body.querySelectorAll('.lab-popover')).toHaveLength(1)
    expect(document.body.querySelector('.lab-popover')!.textContent).toContain('Formula not written yet')
  })

  it('results put the table before the plot, with ƒ on the mean and the variance, and no verdict', () => {
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={params} result={result} isLoading={false}
      error={null} onRetry={() => {}} precision={3} />))
    const titles = [...container.querySelectorAll('h3')].map((heading) => heading.textContent)
    expect(titles).toEqual(['Result', 'Mean and variance', 'Probability mass'])
    expect(container.querySelectorAll('table button.lab-fx')).toHaveLength(2)
    expect(container.querySelector('.hp-out')!.getAttribute('aria-busy')).toBe('false')
    expect(container.textContent).not.toMatch(/reject|significant/i)
  })

  it('while the next result loads the last one stays, dimmed, under "Updating…"', () => {
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={params} result={result} isLoading
      error={null} onRetry={() => {}} precision={3} />))
    expect(container.querySelector('.hp-out')!.className).toContain('is-updating')
    expect(container.textContent).toContain('Updating…')
    expect(container.textContent).toContain('0.616')
  })

  it('the Mean and Variance table cells follow the distribution', () => {
    act(() => root.render(<CommonDistObservation distParams={params} appliedParams={params} result={result} isLoading={false}
      error={null} onRetry={() => {}} precision={3} />))
    const rows = [...container.querySelectorAll('tbody tr')].map((row) => row.textContent)
    expect(rows[0]).toContain('1.235')
    expect(rows[1]).toContain('5')
  })
})
