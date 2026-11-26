import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ADVANCED_IDS } from './descriptiveOptions'
import { StatFx, statFormula } from './descriptiveFormulas'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
async function open(id: string, corrected: boolean, note?: string) {
  await act(async () => root.render(<StatFx key={`${id}${corrected}${note}`} id={id} corrected={corrected} note={note} />))
  await act(async () => container.querySelector<HTMLButtonElement>('button.lab-fx')!.click())
  return document.querySelector('.lab-popover')!
}

describe('statFormula', () => {
  const ids = ['minimum', 'maximum', 'quantiles', 'mean', 'median', 'std_dev_1', 'variance_1', ...ADVANCED_IDS]

  it('has a formula, a name and a plain-language line for every statistic the page offers', () => {
    for (const id of ids) {
      const found = statFormula(id, false)
      expect(found.tex, id).toHaveLength(1)
      expect(found.title, id).not.toBe(id)
      expect(found.def, id).not.toBe('')
    }
  })

  it('adds the bias correction only for the statistics that have one, and only when the corrected column is on', () => {
    expect(statFormula('std_dev_1', false).tex).toHaveLength(1)
    expect(statFormula('std_dev_1', true).tex).toHaveLength(2)
    expect(statFormula('variance_0', true).tex).toHaveLength(2)
    expect(statFormula('range', true).tex).toHaveLength(2)
    expect(statFormula('mean', true).tex).toHaveLength(1)
  })

  it('adds the consistency correction of MAD, IQR and AAD, separate from the bias corrections', () => {
    for (const id of ['mad', 'iqr', 'aad']) expect(statFormula(id, true).tex, id).toHaveLength(2)
    expect(statFormula('mad', true).tex[1]).toContain('1.4826')
    expect(statFormula('std_dev_1', true).tex[1]).toContain('c_4')
  })
})

describe('StatFx popover', () => {
  it('typesets every statistic without errors', async () => {
    for (const id of ['minimum', 'maximum', 'quantiles', 'mean', 'median', 'std_dev_1', 'variance_1', ...ADVANCED_IDS]) {
      const popover = await open(id, true)
      expect(popover.querySelector('.katex-error'), id).toBeNull()
      expect(popover.querySelectorAll('.katex').length, id).toBeGreaterThan(0)
    }
  })

  it('writes skewness and kurtosis over several lines', async () => {
    expect((await open('skewness', false)).querySelectorAll('math mtr').length).toBeGreaterThanOrEqual(2)
    expect((await open('kurtosis', false)).querySelectorAll('math mtr').length).toBeGreaterThanOrEqual(3)
  })

  it('says which formula is the normal correction, and shows the constant c4 it was given', async () => {
    const popover = await open('std_dev_1', true, 'c₄(n = 10) = 0.972659')
    expect(popover.textContent).toContain('normal correction')
    expect(popover.textContent).toContain('c₄(n = 10) = 0.972659')
    const plain = await open('std_dev_1', false, 'c₄(n = 10) = 0.972659')
    expect(plain.textContent).not.toContain('c₄(n = 10)')
  })

  it('shows no button for a statistic without a formula', async () => {
    await act(async () => root.render(<StatFx id="nothing" corrected={false} />))
    expect(container.querySelector('button')).toBeNull()
  })
})
