import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tour, { firstVisible } from './Tour'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  // jsdom has no layout: an element marked data-hidden has no box, as one under display: none has none.
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.closest('[data-hidden]') ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('firstVisible', () => {
  it('skips a match that is not rendered, so the spotlight never goes to 0, 0', () => {
    container.innerHTML = '<div id="a" class="x" data-hidden></div><div id="b" class="x"></div>'
    expect(firstVisible('.x')?.id).toBe('b')
  })

  it('finds nothing when every match is hidden, display: none or visibility: hidden', () => {
    container.innerHTML = '<div class="x" data-hidden></div><div class="x" style="visibility: hidden"></div>'
    expect(firstVisible('.x')).toBeNull()
  })
})

describe('the tour', () => {
  it('passes over a step whose part is not on screen', () => {
    const page = document.createElement('div') // outside the React root, which owns `container`
    page.innerHTML = '<div data-tour="data" data-hidden></div><div data-tour="inputs"></div>'
    document.body.append(page)
    act(() => root.render(<Tour open onClose={() => {}} />))
    expect(document.querySelector('.tour-coach h3')?.textContent).toBe('Inputs')
  })

  it('starts at step 1 again each time it opens', () => {
    const page = document.createElement('div')
    page.innerHTML = '<div data-tour="data"></div><div data-tour="inputs"></div>'
    document.body.append(page)
    act(() => root.render(<Tour open onClose={() => {}} />))
    act(() => document.querySelector<HTMLButtonElement>('.tour-coach .sh-btn-primary')!.click())
    expect(document.querySelector('.tour-coach h3')?.textContent).toBe('Inputs')
    act(() => root.render(<Tour open={false} onClose={() => {}} />))
    act(() => root.render(<Tour open onClose={() => {}} />))
    expect(document.querySelector('.tour-coach h3')?.textContent).toBe('Data')
  })
})
