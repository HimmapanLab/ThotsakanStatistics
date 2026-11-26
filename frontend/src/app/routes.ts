// app/routes.ts
// The pages of the app and how the address bar names them. Shared contract of the rebuild: every area imports
// `Route` from here and nobody changes these exports. The page names and wording live in content/topics.ts.
import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Route =
  | 'home'
  | 'probability'
  | 'statistics-graphical'
  | 'statistics-descriptive'
  | 'statistics-inference'
  | 'hypothesis'
  | 'regression'

export type StatsRoute = Extract<Route, `statistics-${string}`>

/** Every route, in the order of the top bar. */
export const ROUTES: readonly Route[] = [
  'home',
  'probability',
  'statistics-graphical',
  'statistics-descriptive',
  'statistics-inference',
  'hypothesis',
  'regression',
]

/** The sub-topics of Statistics, in menu order. Their names and descriptions are in content/topics.ts. */
export const STATS_SUB: readonly StatsRoute[] = [
  'statistics-graphical',
  'statistics-descriptive',
  'statistics-inference',
]

export function isStatsRoute(route: Route): route is StatsRoute {
  return (STATS_SUB as readonly string[]).includes(route)
}

/** The last page the reader was on, so a reload without an address lands there. */
export const ROUTE_KEY = 'tsl.route'

/**
 * The route an address names. `#statistics` is the first Statistics page; an empty or unknown address is `home`
 * (or `fallback`). `#preferences` is not a page: it opens the Preferences sheet over the current page.
 */
export function routeFromHash(hash: string, fallback: Route = 'home'): Route {
  const name = (hash ?? '').replace(/^#/, '')
  if (name === 'statistics') return 'statistics-graphical'
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : fallback
}

/** Whether the address asks for the Preferences sheet. */
export function isPreferencesHash(hash: string): boolean {
  return (hash ?? '').replace(/^#/, '') === 'preferences'
}

// ── The address bar as a store ──────────────────────────────────────────────────

const CHANGE = 'tsl:hashchange'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  window.addEventListener(CHANGE, onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener(CHANGE, onChange)
  }
}

const currentHash = () => window.location.hash
const serverHash = () => ''

/** Change the address without adding a history entry, and tell every hook about it. */
function replaceHash(hash: string): void {
  try {
    window.history.replaceState(window.history.state, '', hash)
  } catch {
    window.location.hash = hash
  }
  window.dispatchEvent(new Event(CHANGE))
}

function savedRoute(): Route | null {
  try {
    const saved = localStorage.getItem(ROUTE_KEY)
    return saved && (ROUTES as readonly string[]).includes(saved) ? (saved as Route) : null
  } catch {
    return null
  }
}

function saveRoute(route: Route): void {
  try { localStorage.setItem(ROUTE_KEY, route) } catch { /* the page is simply not remembered */ }
}

/** The page under the Preferences sheet, so opening and closing it does not change the page. */
let shown: Route = 'home'

/**
 * The page the address names, and a setter that changes it. An empty address restores the page the reader was
 * last on (localStorage `tsl.route`); a link such as `#hypothesis` always wins over it.
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const hash = useSyncExternalStore(subscribe, currentHash, serverHash)
  const empty = hash.replace(/^#/, '') === ''

  let route: Route
  if (isPreferencesHash(hash)) route = shown
  else if (empty) route = savedRoute() ?? 'home'
  else route = routeFromHash(hash)
  shown = route

  // A restored page gets its address, so the link in the bar says where the reader is.
  useEffect(() => {
    if (empty && route !== 'home') replaceHash('#' + route)
  }, [empty, route])

  useEffect(() => { saveRoute(route) }, [route])

  const setRoute = useCallback((next: Route) => {
    window.location.hash = '#' + next
  }, [])
  return [route, setRoute]
}

/**
 * Whether the Preferences sheet is open. `#preferences` opens it over the current page; closing it puts the
 * page's own address back, without adding a history entry.
 */
export function usePreferencesOpen(): [boolean, (open: boolean) => void] {
  const hash = useSyncExternalStore(subscribe, currentHash, serverHash)
  const open = isPreferencesHash(hash)
  const setOpen = useCallback((next: boolean) => {
    if (next) {
      if (!isPreferencesHash(window.location.hash)) window.location.hash = '#preferences'
    } else if (isPreferencesHash(window.location.hash)) {
      replaceHash('#' + shown)
    }
  }, [])
  return [open, setOpen]
}
