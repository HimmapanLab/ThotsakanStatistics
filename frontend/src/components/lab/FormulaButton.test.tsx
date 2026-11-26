import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FormulaButton from './FormulaButton'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const trigger = (name = 'Formula for Mean') => container.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement
const popover = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null

describe('FormulaButton', () => {
  it('is a closed ƒ button until it is pressed', () => {
    act(() => root.render(<FormulaButton title="Mean" tex="\bar{x}=\frac{1}{n}\sum x_i" />))
    expect(trigger().textContent).toBe('ƒ')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(popover()).toBeNull()
  })

  it('opens a popover with the title, the typeset formula and the plain line, and moves focus into it', () => {
    act(() => root.render(<FormulaButton title="Mean" tex={['a=b', 'c=d']}>The average of the values.</FormulaButton>))
    act(() => trigger().click())
    const pop = popover()!
    expect(pop).not.toBeNull()
    expect(pop.getAttribute('aria-label')).toBe('Formula: Mean')
    expect(pop.querySelector('h3')!.textContent).toBe('Mean')
    expect(pop.querySelectorAll('.katex').length).toBe(2)
    expect(pop.textContent).toContain('The average of the values.')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(pop)
  })

  it('closes on Escape and puts focus back on the button', () => {
    act(() => root.render(<FormulaButton title="Mean" tex="a=b" />))
    act(() => trigger().click())
    act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(popover()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger())
  })

  it('closes with its close button and returns focus', () => {
    act(() => root.render(<FormulaButton title="Mean" tex="a=b" />))
    act(() => trigger().click())
    act(() => (popover()!.querySelector('button[aria-label="Close formula"]') as HTMLButtonElement).click())
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('closes on a click outside', () => {
    act(() => root.render(<div><FormulaButton title="Mean" tex="a=b" /><p id="elsewhere">elsewhere</p></div>))
    act(() => trigger().click())
    act(() => { document.getElementById('elsewhere')!.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(popover()).toBeNull()
  })

  it('keeps one popover open at a time', () => {
    act(() => root.render(<div><FormulaButton title="Mean" tex="a=b" /><FormulaButton title="Median" tex="c=d" /></div>))
    act(() => trigger('Formula for Mean').click())
    act(() => trigger('Formula for Median').click())
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(1)
    expect(popover()!.getAttribute('aria-label')).toBe('Formula: Median')
    expect(trigger('Formula for Mean').getAttribute('aria-expanded')).toBe('false')
  })
})
