import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorFallback } from './ErrorFallback'
import { isChunkLoadError, withRetry } from './lazyRetry'

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js')

describe('isChunkLoadError', () => {
  it('knows the messages browsers and bundlers give for a chunk that did not download', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 7 failed.'), { name: 'ChunkLoadError' }))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})

describe('withRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('asks again after a failed download and returns the module when a retry works', async () => {
    const load = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce({ default: 'page' })
    const result = withRetry(load, [100])()
    await vi.advanceTimersByTimeAsync(100)
    await expect(result).resolves.toEqual({ default: 'page' })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('gives up with the original error once the retries run out', async () => {
    const load = vi.fn().mockRejectedValue(chunkError())
    const result = withRetry(load, [100, 100])()
    const failed = expect(result).rejects.toThrow('Failed to fetch dynamically imported module')
    await vi.advanceTimersByTimeAsync(300)
    await failed
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('does not retry an error that is not a download failure', async () => {
    const load = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withRetry(load, [100])()).rejects.toThrow('boom')
    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('ErrorFallback', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it('offers a reload, not a retry that cannot work, when a page failed to download', () => {
    const reset = vi.fn()
    const reload = vi.fn()
    act(() => root.render(<ErrorFallback error={chunkError()} resetErrorBoundary={reset} reload={reload} />))
    expect(container.querySelector('h2')?.textContent).toContain('could not be loaded')
    act(() => container.querySelector('button')!.click())
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('keeps Recover and Restart for any other error', () => {
    const reset = vi.fn()
    const reload = vi.fn()
    act(() => root.render(<ErrorFallback error={new Error('boom')} resetErrorBoundary={reset} reload={reload} />))
    expect(container.querySelector('button')?.textContent).toBe('Recover and Restart')
    act(() => container.querySelector('button')!.click())
    expect(reset).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })
})
