// The top bar. Prototype: topbar, setTopLevel / topbarOver / fitTopbar, and the hover logic of the topic menu.
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isStatsRoute, type Route } from '../app/routes'
import { APP_NAME, TOP_BAR_TOPICS } from '../content/topics'
import { useAuth } from '../context/AuthContext'
import { ChevDownIcon, GearIcon, HelpIcon } from './icons'
import { TopicMenu, TopicsPopover } from './TopicMenu'

/** How long the pointer rests on Statistics before the menu opens. */
export const MENU_OPEN_DELAY = 120
/** How long the menu stays open after the pointer leaves, so a wobbly move does not close it. */
export const MENU_CLOSE_DELAY = 300

const LEVELS = ['tb-c-icons', 'tb-c-badge', 'tb-c-brand', 'tb-c-topics', 'tb-c-gutter', 'tb-c-name']

function setLevel(bar: HTMLElement, n: number) {
  LEVELS.forEach((name, i) => bar.classList.toggle(name, i < n))
  bar.querySelectorAll<HTMLElement>('[data-collapsed-tip]').forEach((el) => {
    if (n >= 1) el.title = el.dataset.collapsedTip ?? ''
    else el.removeAttribute('title')
  })
}

/** Whether anything in the bar reaches past its right padding. */
function overflows(bar: HTMLElement): boolean {
  const padding = parseFloat(getComputedStyle(bar).paddingRight) || 0
  const limit = bar.getBoundingClientRect().right - padding
  let over = bar.scrollWidth > bar.clientWidth
  for (const child of Array.from(bar.children)) {
    if (child.classList.contains('tb-wm')) continue // the watermark layer spans the whole bar on purpose
    if (getComputedStyle(child).display === 'none') continue
    const r = child.getBoundingClientRect()
    if (r.width > 0 && r.right > limit + 0.5) over = true
  }
  return over
}

/** Step the bar down one level at a time until it fits. Measured, never keyed to the viewport width. */
function fit(bar: HTMLElement) {
  let n = 0
  setLevel(bar, 0)
  while (n < LEVELS.length && overflows(bar)) {
    n += 1
    setLevel(bar, n)
  }
}

function Header({ route, onTour }: { route: Route; onTour: () => void }) {
  const { user, signOut, config } = useAuth()
  const home = route === 'home'
  const inStats = isStatsRoute(route)

  const barRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const topicsBtnRef = useRef<HTMLButtonElement>(null)

  // The level classes are written onto the bar directly, and the bar is measured again after every render
  // (the route, the badges and the text size all change what has to fit).
  useLayoutEffect(() => {
    if (barRef.current) fit(barRef.current)
  })
  useEffect(() => {
    const refit = () => window.requestAnimationFrame(() => barRef.current && fit(barRef.current))
    window.addEventListener('resize', refit)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit)
    observer?.observe(document.documentElement)
    // The measure changes when the webfont arrives.
    void document.fonts?.ready.then(refit)
    return () => {
      window.removeEventListener('resize', refit)
      observer?.disconnect()
    }
  }, [])

  // ── The Statistics menu ──────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }, [])
  const openMenu = useCallback((focus: boolean) => {
    clearTimers()
    setMenuOpen(true)
    if (focus) setFocusToken((t) => t + 1)
  }, [clearTimers])
  const closeMenu = useCallback((returnFocus: boolean) => {
    clearTimers()
    setMenuOpen(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [clearTimers])
  const closeSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), MENU_CLOSE_DELAY)
  }, [])
  const closeTopics = useCallback((returnFocus: boolean) => {
    setTopicsOpen(false)
    if (returnFocus) topicsBtnRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => clearTimers, [clearTimers])
  // Moving to another page closes whatever is open.
  useEffect(() => {
    clearTimers()
    setMenuOpen(false)
    setTopicsOpen(false)
  }, [route, clearTimers])

  // A press anywhere else closes a menu.
  useEffect(() => {
    if (!menuOpen && !topicsOpen) return
    const onDown = (event: Event) => {
      const target = event.target as Element
      if (triggerRef.current?.contains(target) || topicsBtnRef.current?.contains(target)) return
      if (target.closest?.('.tm-pop, .tp-pop')) return
      setMenuOpen(false)
      setTopicsOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [menuOpen, topicsOpen])

  const current = TOP_BAR_TOPICS.find((topic) => topic.hasMenu ? inStats : topic.route === route)

  return (
    <header ref={barRef} className={`tb${home ? '' : ' has-wm'}`}>
      {!home && <span className="tb-wm" aria-hidden="true" />}
      {!home && (
        <>
          <a className="tb-brand" href="#home" aria-label={`${APP_NAME}, home`}>
            <span className="tb-brand-name">{APP_NAME}</span>
          </a>
          <nav className="tb-topics" aria-label="Topics">
            {TOP_BAR_TOPICS.map((topic) => topic.hasMenu ? (
              <button
                key={topic.route}
                ref={triggerRef}
                type="button"
                className={`tb-trigger${inStats ? ' is-current' : ''}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-current={inStats ? 'page' : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'mouse') return
                  window.clearTimeout(closeTimer.current)
                  if (menuOpenRef.current) return
                  window.clearTimeout(openTimer.current)
                  openTimer.current = window.setTimeout(() => openMenu(false), MENU_OPEN_DELAY)
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== 'mouse') return
                  window.clearTimeout(openTimer.current)
                  const to = event.relatedTarget as Element | null
                  if (menuOpenRef.current && !to?.closest?.('.tm-pop')) closeSoon()
                }}
                onClick={(event) => {
                  // detail 0 is a keyboard "click" after Enter or Space: keep the menu open and move into it
                  if (menuOpenRef.current && event.detail !== 0) closeMenu(false)
                  else openMenu(event.detail === 0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openMenu(true)
                  }
                }}
              >
                {topic.name}
                <ChevDownIcon />
              </button>
            ) : (
              <a key={topic.route} href={`#${topic.route}`} aria-current={topic.route === route ? 'page' : undefined}>
                {topic.name}
              </a>
            ))}
          </nav>
          <button
            ref={topicsBtnRef}
            type="button"
            className="sh-btn sh-btn-quiet tb-topics-btn"
            aria-haspopup="dialog"
            aria-expanded={topicsOpen}
            onClick={() => setTopicsOpen((open) => !open)}
          >
            <span className="tb-topics-name">{current?.name ?? 'Topics'}</span>
            <ChevDownIcon />
          </button>
        </>
      )}
      <span className="tb-spacer" />
      {config?.demo && (
        <span className="tb-badge" title="Demo version: no sign-in. An uploaded file is kept in memory for at most 30 minutes and never saved.">
          Demo
        </span>
      )}
      {config && !config.enabled && !config.demo && (
        <span className="tb-badge is-warn" title="AUTH_DISABLED=true: login is skipped. Never use in production.">
          <span className="tb-long">Auth disabled (dev)</span>
          <span className="tb-short" aria-hidden="true">Dev</span>
        </span>
      )}
      {user && config?.enabled && (
        <span className="tb-user">
          <span className="who" title={user.email}>{user.name || user.email}</span>
          <button type="button" className="sh-btn sh-btn-quiet" onClick={() => { void signOut() }}>Sign out</button>
        </span>
      )}
      <button type="button" className="sh-btn sh-btn-quiet tb-btn" data-collapsed-tip="Take the tour" aria-label="Take the tour" onClick={onTour}>
        <HelpIcon /><span className="lbl">Take the tour</span>
      </button>
      <a className="sh-btn sh-btn-quiet tb-btn" href="#preferences" data-collapsed-tip="Preferences" aria-label="Preferences">
        <GearIcon /><span className="lbl">Preferences</span>
      </a>
      {menuOpen && !home && (
        <TopicMenu
          anchor={triggerRef.current}
          route={route}
          focusToken={focusToken}
          onClose={closeMenu}
          onPointerEnter={() => window.clearTimeout(closeTimer.current)}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') closeSoon() }}
        />
      )}
      {topicsOpen && !home && <TopicsPopover anchor={topicsBtnRef.current} route={route} onClose={closeTopics} />}
    </header>
  )
}

export default memo(Header)
