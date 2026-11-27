import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DataProvider } from './context/DataContext'
import { DrawerProvider } from './context/DrawerContext'
import { memoryCsvStore, saveSession, setCsvStore } from './lib/sessionStore'

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), config: { enabled: false, clientId: '', allowedDomain: '' } }),
}))

let root: Root
let container: HTMLDivElement
const settle = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })
const goTo = async (hash: string) => {
  await act(async () => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await settle()
}
const mount = async () => {
  await act(async () => root.render(<DataProvider><DrawerProvider><App /></DrawerProvider></DataProvider>))
  await settle()
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  sessionStorage.clear()
  setCsvStore(memoryCsvStore())
  window.location.hash = '#probability'
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('the app after a refresh', () => {
  it('shows the shell, not a blank app, while the data from last time is coming back', async () => {
    saveSession({ sessionId: 'old', filename: 'Howell.csv', exampleKey: 'Howell.csv' })
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {}))) // the example never arrives
    window.location.hash = '#statistics-graphical'
    await mount()
    expect(container.querySelector('header')).not.toBeNull()
    expect(container.textContent).toContain('Loading data')
    expect(container.querySelector('.bench')).toBeNull()
  })

  it('shows the "could not restore" notice on the Probability page itself, and still opens the drawer on a page that has one', async () => {
    saveSession({ sessionId: 'old', filename: 'mine.csv', exampleKey: null }) // no copy in the store: it is gone
    await mount()
    const notice = container.querySelector('.status-warning[role="status"]')
    expect(notice?.textContent).toContain('mine.csv from your last visit is not stored in this browser any more')
    expect(container.querySelector('.data-drawer')).toBeNull()
    // The notice was not used up on Probability: the drawer opens when the reader reaches a page with one.
    await goTo('#statistics-descriptive')
    expect(container.querySelector('.data-drawer')).not.toBeNull()
  })
})
