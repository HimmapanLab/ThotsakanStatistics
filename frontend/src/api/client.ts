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
  if (!text) return `The server answered with status ${response.status} and no message. Try again in a moment.`
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

async function send(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  await waitForOnline(signal)
  try {
    return await fetch(path, { ...init, signal })
  } catch (error) {
    // A network failure while offline: wait for the connection, then try once more.
    if ((error as Error)?.name !== 'AbortError' && isOffline()) {
      await waitForOnline(signal)
      return fetch(path, { ...init, signal })
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
  let response = await attempt(original ? liveSessionId(original) : null)
  if (response.status === 404 && original) {
    const message = await readError(response.clone())
    if (SESSION_LOST.test(message)) {
      const fresh = await renew(original)
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (fresh) response = await attempt(fresh)
    }
  }
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  return response.json() as Promise<T>
}

/** Upload a CSV and return the new session id. */
export async function uploadCsv(file: File, signal?: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const response = await send('/api/data/upload', { method: 'POST', body: form }, signal)
  if (!response.ok) throw new ApiError(await readError(response), response.status)
  const data = await response.json() as { session_id: string }
  return data.session_id
}
