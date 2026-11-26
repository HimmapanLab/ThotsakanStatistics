import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrawerProvider, useDrawer } from '../context/DrawerContext'
import { NoDataState } from './EmptyStates'

const loadFile = vi.fn()
vi.mock('../context/DataContext', () => ({ useData: () => ({ loadFile }) }))

let root: Root
let container: HTMLDivElement

function Probe() {
  return <output data-testid="open">{useDrawer().open ? 'open' : 'closed'}</output>
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  loadFile.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<DrawerProvider><NoDataState /><Probe /></DrawerProvider>))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const button = (name: string) => Array.from(container.querySelectorAll('button')).find((element) => element.textContent === name)!

describe('No data loaded yet', () => {
  it('Open Data opens the drawer', async () => {
    await act(async () => button('Open Data').click())
    expect(container.querySelector('[data-testid="open"]')!.textContent).toBe('open')
  })

  it('Use Electricity demand loads that example through the data loader', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('demand,temp\n1,2\n')))
    await act(async () => button('Use Electricity demand').click())
    expect((loadFile.mock.calls[0][0] as File).name).toBe('ElectricityDemand.csv')
    expect(loadFile.mock.calls[0][1]).toEqual({ exampleKey: 'ElectricityDemand.csv' })
  })
})
