/** A page chunk that could not be downloaded (offline, or a new release replaced the file the old page asks for). */
export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(text)
}

const RETRY_DELAYS_MS = [400, 1500]

/**
 * Wrap the loader given to `lazy()` so that it asks again when the download fails. React keeps a failed lazy
 * component failed for good, so a flaky connection would need a page reload; a few quiet retries cover it.
 * When they run out the error reaches the error boundary, which offers a reload (see ErrorFallback).
 */
export function withRetry<Module>(load: () => Promise<Module>, delays: readonly number[] = RETRY_DELAYS_MS): () => Promise<Module> {
  return async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await load()
      } catch (error) {
        if (attempt >= delays.length || !isChunkLoadError(error)) throw error
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
      }
    }
  }
}
