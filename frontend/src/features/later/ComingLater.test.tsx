import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ComingLater from './ComingLater'

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

describe('ComingLater', () => {
  it('shows the illustration over the title and the text, then one way back', () => {
    const onBack = vi.fn()
    act(() => root.render(<ComingLater onBack={onBack} />))
    const section = container.querySelector('section')!
    expect(section.getAttribute('aria-labelledby')).toBe('later-title')
    const kids = Array.from(section.children).map((c) => c.tagName.toLowerCase())
    expect(kids).toEqual(['svg', 'h1', 'p', 'button'])
    expect(section.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(section.querySelector('h1')!.textContent).toBe('Linear Regression')
    expect(section.querySelector('p')!.textContent).toContain('two Continuous columns')
    const back = section.querySelector('button')!
    expect(back.textContent).toBe('Back to the topics')
    act(() => back.click())
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
