// The Statistics menu of the top bar, and the Topics popover the bar folds into when it is too narrow.
// Prototype: tmHtml / tmOpen / tmClose, openTopicsMenu.
import { useEffect, useLayoutEffect, useRef, type PointerEventHandler } from 'react'
import { createPortal } from 'react-dom'
import type { Route } from '../app/routes'
import { STATS_SUB_TOPICS, TOP_BAR_TOPICS } from '../content/topics'
import { CheckIcon, CloseIcon } from './icons'

interface TopicMenuProps {
  /** The button that opened it: the menu sits under it. */
  anchor: HTMLElement | null
  route: Route
  /** Changes each time focus should move to the current (or first) item. */
  focusToken: number
  onClose: (returnFocus: boolean) => void
  onPointerEnter: PointerEventHandler<HTMLDivElement>
  onPointerLeave: PointerEventHandler<HTMLDivElement>
}

/**
 * The sub-topics of Statistics as a menu. ArrowDown/ArrowUp, Home and End move between the items, Tab closes it
 * and Esc closes it and returns focus to the button. Choosing an item is a plain link to its page.
 */
export function TopicMenu({ anchor, route, focusToken, onClose, onPointerEnter, onPointerLeave }: TopicMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  const place = () => {
    const el = ref.current
    if (!el || !anchor) return
    const r = anchor.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    el.style.top = `${Math.round(r.bottom + 4)}px`
    el.style.left = `${Math.round(Math.min(Math.max(8, r.left), Math.max(8, vw - el.offsetWidth - 8)))}px`
  }

  useLayoutEffect(place)

  useEffect(() => {
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })

  // Focus moves into the menu only when it was asked for (keyboard); hovering never takes focus.
  useEffect(() => {
    if (focusToken === 0) return
    const items = ref.current?.querySelectorAll<HTMLElement>('.tm-item')
    const current = ref.current?.querySelector<HTMLElement>('.tm-item[aria-current="page"]')
    ;(current ?? items?.[0])?.focus({ preventScroll: true })
  }, [focusToken])

  // Esc works wherever focus is while the menu is open (a hover leaves focus on the page).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose(true)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('.tm-item') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => { event.preventDefault(); items[(n + items.length) % items.length]?.focus() }
    if (event.key === 'ArrowDown') go(i + 1)
    else if (event.key === 'ArrowUp') go(i < 0 ? items.length - 1 : i - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
    else if (event.key === 'Tab') onClose(false)
  }

  return createPortal(
    <div ref={ref} className="tm-pop" role="menu" aria-label="Statistics" onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {STATS_SUB_TOPICS.map((topic) => (
        <a key={topic.route} className="tm-item" role="menuitem" href={`#${topic.route}`}
          aria-current={route === topic.route ? 'page' : undefined} onClick={() => onClose(false)}>
          <CheckIcon />
          <span className="tm-name">{topic.name}</span>
          <span className="tm-desc">{topic.description}</span>
        </a>
      ))}
    </div>,
    document.body,
  )
}

/** The whole topic list as one popover, for a bar too narrow for the links. */
export function TopicsPopover({ anchor, route, onClose }: {
  anchor: HTMLElement | null
  route: Route
  onClose: (returnFocus: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const place = () => {
    const el = ref.current
    if (!el || !anchor) return
    const r = anchor.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    el.style.top = `${Math.round(r.bottom + 4)}px`
    el.style.left = `${Math.round(Math.min(Math.max(8, r.left), Math.max(8, vw - el.offsetWidth - 8)))}px`
  }

  useLayoutEffect(() => {
    place()
    ref.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose(true)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div ref={ref} className="tp-pop" role="dialog" aria-label="Topics" tabIndex={-1}>
      <div className="tp-head">
        <h2>Topics</h2>
        <button type="button" className="sh-btn sh-btn-quiet sh-btn-icon" aria-label="Close Topics" onClick={() => onClose(true)}>
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Topics menu">
        <ul className="tp-list">
          {TOP_BAR_TOPICS.map((topic) => topic.hasMenu ? (
            <li key={topic.route}>
              <span className="group">{topic.name}</span>
              <ul className="tp-list">
                {STATS_SUB_TOPICS.map((sub) => (
                  <li key={sub.route} className="sub">
                    <a href={`#${sub.route}`} aria-current={route === sub.route ? 'page' : undefined} onClick={() => onClose(false)}>{sub.name}</a>
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={topic.route}>
              <a href={`#${topic.route}`} aria-current={route === topic.route ? 'page' : undefined} onClick={() => onClose(false)}>{topic.name}</a>
            </li>
          ))}
        </ul>
      </nav>
    </div>,
    document.body,
  )
}
