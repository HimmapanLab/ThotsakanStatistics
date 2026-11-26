import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenDrawerOnNotice } from './useOpenDrawerOnNotice'

let root: Root
let container: HTMLDivElement
const open = vi.fn()

function Probe({ notice, enabled }: { notice: string; enabled: boolean }) {
  useOpenDrawerOnNotice(notice, enabled, open)
  return null
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  open.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('opening the Data drawer for a notice', () => {
  it('opens once when data could not be brought back, and not again for the same notice', () => {
    act(() => root.render(<Probe notice="Howell.csv is not stored in this browser any more." enabled />))
    expect(open).toHaveBeenCalledTimes(1)
    act(() => root.render(<Probe notice="Howell.csv is not stored in this browser any more." enabled />))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a notice', () => {
    act(() => root.render(<Probe notice="" enabled />))
    expect(open).not.toHaveBeenCalled()
  })

  it('waits for a page that has a drawer', () => {
    act(() => root.render(<Probe notice="Gone." enabled={false} />))
    expect(open).not.toHaveBeenCalled()
    act(() => root.render(<Probe notice="Gone." enabled />))
    expect(open).toHaveBeenCalledTimes(1)
  })
})
