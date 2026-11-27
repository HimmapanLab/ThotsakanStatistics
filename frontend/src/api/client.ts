// api/client.ts
// The one way the app talks to /api. It adds the session header, reads the server's error message, renews an
// expired session by re-uploading the dataset (once per call), and waits for the connection when offline.
//
// Session ids: React keeps the id it got when the data was loaded, so the tabs never think the dataset changed.
// When the server has forgotten that id (30 minutes idle, or a restart), `renew` uploads the same CSV again and
// the client maps the old id to the new one from then on. See REBUILD-HANDOFF, "Keeping the session".

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** The server's wording for a lost session (backend/api/deps.py). */
export const SESSION_LOST = /session expired or not found/i

type Renewer = (staleId: string) => Promise<string | null>

let renewer: Renewer | null = null
const aliases = new Map<string, string>()
const pendingRenewals = new Map<string, Promise<string | null>>()

/** DataContext registers how to re-upload the current dataset. */
export function setSessionRenewer(next: Renewer | null) {
  renewer = next
}

/** The id the server currently knows for a dataset React loaded under `id`. */
export function liveSessionId(id: string): string {
  let current = id
  const seen = new Set<string>()
  while (aliases.has(current) && !seen.has(current)) {
    seen.add(current)
    current = aliases.get(current)!
  }
  return current
}

/** Forget every alias, when the data is removed or replaced. */
export function resetSessionAliases() {
  aliases.clear()
  pendingRenewals.clear()
}

async function renew(id: string): Promise<string | null> {
  if (!renewer) return null
  const live = liveSessionId(id)
  // Parallel tabs that hit the same expired session share one re-upload.
  let pending = pendingRenewals.get(live)
  if (!pending) {
    pending = renewer(live).then((fresh) => {
      if (fresh && fresh !== live) aliases.set(live, fresh)
      return fresh
    }).finally(() => pendingRenewals.delete(live))
    pendingRenewals.set(live, pending)
  }
  return pending
}

/** FastAPI sends `detail` as a string, or as a list of validation errors. */
export async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  // A proxy in front of a restarting backend answers 502 to 504, often with an HTML page: never show that page.
  if (response.status >= 502 && response.status <= 504) return UNREACHABLE
  if (!text) {
    return response.status === 500
      ? 'The server did not answer properly. It may be restarting: try again in a moment.'
      : `The server answered with status ${response.status} and no message. Try again in a moment.`
  }
  if (text.trimStart().startsWith('<')) return UNREACHABLE
  try {
    const body = JSON.parse(text) as { detail?: unknown }
    const detail = body.detail
    if (typeof detail === 'string' && detail) return detail
    if (Array.isArray(detail)) {
      return detail.map((item) => (item && typeof item === 'object' && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item))).join('; ')
    }
  } catch { /* plain text */ }
  return text
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Resolves when the browser is back online; rejects with an AbortError if the request is cancelled first. */
export function waitForOnline(signal?: AbortSignal): Promise<void> {
  if (!isOffline()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
    const cleanup = () => {
      window.removeEventListener('online', done)
      signal?.removeEventListener('abort', abort)
    }
    if (signal?.aborted) return abort()
    window.addEventListener('online', done)
    signal?.addEventListener('abort', abort)
  })
}

/** What a reader sees while a request waits for the connection (components/StatusBanner re-exports it). */
export const OFFLINE_MESSAGE = 'You are offline. Results will update when the connection is back.'

/** A request that has no answer after this long is given up, so "Updating…" never lasts forever. */
export const REQUEST_TIMEOUT_MS = 60_000
/** An upload carries the whole file, so it gets longer. */
export const UPLOAD_TIMEOUT_MS = 120_000
export const TIMEOUT_MESSAGE = 'The server took too long to answer. Try again in a moment.'

/** What a reader sees when the request never reached the server (the browser's own text is "Failed to fetch"). */
export const UNREACHABLE = 'Can’t reach the server. Check your connection and try again.'

/**
 * A network failure is a TypeError from fetch; a cancelled request (AbortError) is passed on unchanged; a request
 * with no answer within `timeoutMs` ends with TIMEOUT_MESSAGE. The timer is ours (not AbortSignal.any) so that it
 * works in every browser, and it starts here, after any wait for the connection.
 */
async function fetchOnce(path: string, init: RequestInit, signal?: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const onAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error(TIMEOUT_MESSAGE)
    if ((error as Error)?.name === 'AbortError') throw error
    throw error instanceof TypeError ? new Error(UNREACHABLE) : error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function send(path: string, init: RequestInit, signal?: AbortSignal, timeoutMs?: number): Promise<Response> {
  await waitForOnline(signal)
  try {
    return await fetchOnce(path, init, signal, timeoutMs)
  } catch (error) {
    // A network failure while offline: wait for the connection, then try once more.
    if ((error as Error)?.name !== 'AbortError' && isOffline()) {
      await waitForOnline(signal)
      return fetchOnce(path, init, signal, timeoutMs)
    }
    throw error
  }
}

export interface PostOptions {
  /** The session id React holds; omit for routes without a session (probability). */
  sessionId?: string | null
  signal?: AbortSignal
}

/** POST JSON to an /api route and return the parsed JSON body. */
export async function postJson<T>(path: string, body: unknown, { sessionId, signal }: PostOptions = {}): Promise<T> {
  const attempt = (id: string | null) => send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(id ? { 'x-session-id': id } : {}) },
    body: JSON.stringify(body),
  }, signal)

  const original = sessionId ?? null
  const sentWith = original ? liveSessionId(original) : null
  let response = await attempt(sentWith)
  if (response.status === 404 && original) {
    const message = await readError(response.clone())
    if (SESSION_LOST.test(message)) {
      // The session may have been renewed while this request was on its way: use that id, do not upload again.
      const live = liveSessionId(original)
      const fresh = live !== sentWith ? live : await renew(original)
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (fresh) response = await attempt(fresh)
    }
  }
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json() as Promise<T>
}

/**
 * Upload a CSV and return the new session id. Offline it fails at once with OFFLINE_MESSAGE instead of waiting
 * (a reader loading data wants to know, and can try again); `signal` cancels it, and it times out.
 */
export async function uploadCsv(file: File, signal?: AbortSignal): Promise<string> {
  if (isOffline()) throw new Error(OFFLINE_MESSAGE)
  const form = new FormData()
  form.append('file', file)
  const response = await send('/api/data/upload', { method: 'POST', body: form }, signal, UPLOAD_TIMEOUT_MS)
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  const data = await response.json() as { session_id: string }
  return data.session_id
}
