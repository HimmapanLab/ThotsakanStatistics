import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, UNREACHABLE, liveSessionId, postJson, resetSessionAliases, setSessionRenewer } from './client'

const LOST = JSON.stringify({ detail: 'Session expired or not found. Please upload the dataset again.' })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const headerOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)['x-session-id']

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  resetSessionAliases()
  setSessionRenewer(null)
})
afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('postJson', () => {
  it('sends the session header and returns the JSON body', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: 1 }))
    await expect(postJson('/api/x', { a: 1 }, { sessionId: 's1' })).resolves.toEqual({ ok: 1 })
    expect(headerOf(fetchMock.mock.calls[0])).toBe('s1')
  })

  it('re-uploads once on a lost session, repeats the call with the new id, and remembers it', async () => {
    const renewer = vi.fn().mockResolvedValue('s2')
    setSessionRenewer(renewer)
    fetchMock
      .mockResolvedValueOnce(new Response(LOST, { status: 404 }))
      .mockResolvedValueOnce(json({ ok: 2 }))
      .mockResolvedValueOnce(json({ ok: 3 }))
    await expect(postJson('/api/x', {}, { sessionId: 's1' })).resolves.toEqual({ ok: 2 })
    expect(renewer).toHaveBeenCalledWith('s1')
    expect(headerOf(fetchMock.mock.calls[1])).toBe('s2')
    expect(liveSessionId('s1')).toBe('s2')
    // The next call goes straight to the new id; React still holds s1.
    await postJson('/api/x', {}, { sessionId: 's1' })
    expect(headerOf(fetchMock.mock.calls[2])).toBe('s2')
  })

  it('shares one re-upload between calls that fail at the same time', async () => {
    let finish!: (id: string) => void
    const renewer = vi.fn(() => new Promise<string>((resolve) => { finish = resolve }))
    setSessionRenewer(renewer)
    fetchMock.mockImplementation((_path: string, init: RequestInit) =>
      Promise.resolve((init.headers as Record<string, string>)['x-session-id'] === 's1' ? new Response(LOST, { status: 404 }) : json({ ok: true })))
    const both = Promise.all([postJson('/api/a', {}, { sessionId: 's1' }), postJson('/api/b', {}, { sessionId: 's1' })])
    await vi.waitFor(() => expect(renewer).toHaveBeenCalled())
    finish('s2')
    await both
    expect(renewer).toHaveBeenCalledTimes(1)
  })

  it('shows the server message when renewing is not possible', async () => {
    fetchMock.mockResolvedValue(new Response(LOST, { status: 404 }))
    await expect(postJson('/api/x', {}, { sessionId: 's1' })).rejects.toThrow(/Session expired or not found/)
  })

  it('does not renew on other errors, and joins validation messages', async () => {
    const renewer = vi.fn()
    setSessionRenewer(renewer)
    fetchMock.mockResolvedValueOnce(json({ detail: [{ msg: 'alpha must be below 0.5' }, { msg: 'column is required' }] }, 422))
    const error = await postJson<never>('/api/x', {}, { sessionId: 's1' }).catch((e: ApiError) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('alpha must be below 0.5; column is required')
    expect(renewer).not.toHaveBeenCalled()
  })

  it('waits while offline and sends once the connection is back', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fetchMock.mockResolvedValue(json({ ok: true }))
    const pending = postJson('/api/probability/compute', {})
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    await expect(pending).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('says the server cannot be reached, not the browser text "Failed to fetch"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(postJson('/api/x', {})).rejects.toThrow(UNREACHABLE)
  })

  it('passes a cancelled request through as an AbortError', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    await expect(postJson('/api/x', {})).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('stops waiting when the request is cancelled', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const controller = new AbortController()
    const pending = postJson('/api/x', {}, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
