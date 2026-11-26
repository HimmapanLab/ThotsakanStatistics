import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataProvider, PRECISION_KEY, useData } from './DataContext'

let root: Root
let container: HTMLDivElement
let api: ReturnType<typeof useData>
function Probe() { api = useData(); return null }
const mount = () => act(() => root.render(<DataProvider><Probe /></DataProvider>))

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('display precision', () => {
  it('defaults to 4 and is saved when changed, without any data loaded', () => {
    mount()
    expect(api.state.displayPrecision).toBe(4)
    act(() => api.setPrecision(6))
    expect(api.state.displayPrecision).toBe(6)
    expect(localStorage.getItem(PRECISION_KEY)).toBe('6')
  })
  it('comes back after a reload and survives removing the data', () => {
    localStorage.setItem(PRECISION_KEY, '2')
    mount()
    expect(api.state.displayPrecision).toBe(2)
    act(() => api.clearData())
    expect(api.state.displayPrecision).toBe(2)
  })
  it('ignores a saved value outside 2 to 6', () => {
    localStorage.setItem(PRECISION_KEY, '12')
    mount()
    expect(api.state.displayPrecision).toBe(6)
  })
})
