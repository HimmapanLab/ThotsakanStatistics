// context/AuthContext.tsx
// Google sign-in state. The backend owns verification and the session cookie;
// this only drives the UI (config → /me → login gate → app).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearSavedData } from '../lib/sessionStore'

export interface AuthUser {
  email: string
  name: string
  picture: string
}

interface AuthConfig {
  enabled: boolean
  demo?: boolean
  clientId: string
  allowedDomain: string
}

type Status = 'loading' | 'signedOut' | 'signedIn' | 'error'

interface AuthContextValue {
  status: Status
  user: AuthUser | null
  config: AuthConfig | null
  error: string
  signIn: (googleCredential: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
  } catch {
    // not JSON
  }
  return `Request failed (status ${res.status})`
}

/** Who the data saved in this browser belongs to, so a different person signing in does not inherit it. */
export const LAST_USER_KEY = 'thotsakan-last-user'

/** Call when `email` is signed in: if the saved data belongs to someone else, it is forgotten first. */
function claimSavedData(email: string): void {
  try {
    const last = localStorage.getItem(LAST_USER_KEY)
    if (last !== null && last !== email) clearSavedData()
    localStorage.setItem(LAST_USER_KEY, email)
  } catch { /* no storage: nothing was kept either */ }
}

function releaseSavedData(): void {
  clearSavedData()
  try { localStorage.removeItem(LAST_USER_KEY) } catch { /* nothing kept */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfgRes = await fetch('/api/auth/config')
        if (!cfgRes.ok) throw new Error(await errorDetail(cfgRes))
        const cfg: AuthConfig = await cfgRes.json()
        if (cancelled) return
        setConfig(cfg)

        const meRes = await fetch('/api/auth/me')
        if (cancelled) return
        if (meRes.ok) {
          const me: AuthUser = await meRes.json()
          if (cancelled) return
          claimSavedData(me.email)
          setUser(me)
          setStatus('signedIn')
        } else {
          setStatus('signedOut')
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Any data call that comes back 401 means the session cookie expired:
  // drop to the login screen instead of leaving every tab showing errors.
  useEffect(() => {
    const original = window.fetch
    window.fetch = async (...args) => {
      const res = await original(...args)
      const input = args[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
      if (res.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
        setUser(null)
        setError('Your session expired. Please sign in again.')
        setStatus('signedOut')
      }
      return res
    }
    return () => { window.fetch = original }
  }, [])

  const signIn = useCallback(async (credential: string) => {
    setError('')
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!res.ok) {
      setError(await errorDetail(res))
      return
    }
    const signedIn: AuthUser = await res.json()
    claimSavedData(signedIn.email)
    setUser(signedIn)
    setStatus('signedIn')
  }, [])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.google?.accounts.id.disableAutoSelect()
    // The next person on this PC must not find this one's data (DataProvider unmounts with the login gate).
    releaseSavedData()
    setUser(null)
    setError('')
    setStatus('signedOut')
  }, [])

  const value = useMemo(
    () => ({ status, user, config, error, signIn, signOut }),
    [status, user, config, error, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
