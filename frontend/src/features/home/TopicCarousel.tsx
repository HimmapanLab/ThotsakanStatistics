// features/home/TopicCarousel.tsx
// The front page: a peek carousel of the four topics. One slide is centred and its neighbours are cut off at both
// edges. It switches by named tabs, arrow buttons, ArrowLeft / ArrowRight / Home / End, or a swipe (the track is a
// scroll-snap strip); a click on a peeking neighbour brings it in. It NEVER moves on its own. The last slide is
// remembered in localStorage. A touch snap gives a light tick (lib/haptics.ts decides whether it may buzz).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { Route } from '../../app/routes'
import { TOPIC_SLIDES, type TopicSlide } from '../../content/topics'
import { haptic } from '../../lib/haptics'
import TopicScene from './TopicScene'
import { prefersReducedMotion } from './sceneHover'

/** Where the last slide is remembered. */
export const SLIDE_KEY = 'tsl.home.slide'
/** The slide shown on a first visit: Statistics, the topic most people come for. */
const FIRST_SLIDE = 1

function savedSlide(count: number): number {
  try {
    const n = parseInt(localStorage.getItem(SLIDE_KEY) ?? '', 10)
    return Number.isFinite(n) && n >= 0 && n < count ? n : FIRST_SLIDE
  } catch {
    return FIRST_SLIDE
  }
}

function saveSlide(i: number): void {
  try { localStorage.setItem(SLIDE_KEY, String(i)) } catch { /* the slide is simply not remembered */ }
}

const ICON_PROPS = { className: 'hm-icon', viewBox: '0 0 20 20', 'aria-hidden': true, focusable: false } as const
const ChevL = () => <svg {...ICON_PROPS}><path d="M12 5l-5 5 5 5" /></svg>
const ChevR = () => <svg {...ICON_PROPS}><path d="M8 5l5 5-5 5" /></svg>

export interface TopicCarouselProps {
  onNavigate: (route: Route) => void
  /** What each slide says about the loaded data: a fit line under "Needs:". */
  fitFor: (slide: TopicSlide) => ReactNode
  /** The loaded dataset's histogram densities, for the Statistics scene. */
  histogram?: readonly number[] | null
}

export default function TopicCarousel({ onNavigate, fitFor, histogram }: TopicCarouselProps) {
  const count = TOPIC_SLIDES.length
  const [index, setIndex] = useState(() => savedSlide(count))
  const [announcement, setAnnouncement] = useState('')
  const current = useRef(index)
  const track = useRef<HTMLDivElement>(null)
  // A button that has just taken the carousel to its end is disabled; focus moves to the other one, not to the page.
  const prevButton = useRef<HTMLButtonElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)

  /** Make slide i the current one. Remembers it, announces it and, after a touch, ticks. */
  const mark = useCallback((i: number) => {
    if (i === current.current) return
    current.current = i
    setIndex(i)
    saveSlide(i)
    setAnnouncement(`${TOPIC_SLIDES[i].name}, ${i + 1} of ${count}`)
    haptic('tick')
  }, [count])

  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const el = track.current
    const slide = el?.children[i] as HTMLElement | undefined
    if (!el || !slide || typeof el.scrollTo !== 'function') return
    el.scrollTo({ left: slide.offsetLeft - (el.clientWidth - slide.offsetWidth) / 2, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
  }, [])

  const go = useCallback((i: number) => {
    const next = Math.min(count - 1, Math.max(0, i))
    scrollTo(next, true)
    mark(next)
  }, [count, mark, scrollTo])

  // Start on the remembered slide, without animating, and keep it centred when the window changes size.
  useLayoutEffect(() => {
    scrollTo(current.current, false)
    const onResize = () => scrollTo(current.current, false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [scrollTo])

  // A swipe ends on the slide nearest the middle of the track.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const mid = el.scrollLeft + el.clientWidth / 2
        let best = 0
        let bestDistance = Infinity
        Array.from(el.children).forEach((child, k) => {
          const s = child as HTMLElement
          const distance = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid)
          if (distance < bestDistance) { bestDistance = distance; best = k }
        })
        mark(best)
      }, 60)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(timer); el.removeEventListener('scroll', onScroll) }
  }, [mark])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea')) return
    const next = event.key === 'ArrowRight' ? current.current + 1
      : event.key === 'ArrowLeft' ? current.current - 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null
    if (next === null) return
    event.preventDefault()
    go(next)
  }

  const onSlideClick = (event: MouseEvent<HTMLElement>, i: number) => {
    if (i === current.current || (event.target as HTMLElement).closest('a, button')) return
    go(i)
  }

  return (
    <section className="ct" aria-roledescription="carousel" aria-label="Topics" onKeyDown={onKeyDown}>
      <div className="ct-track" ref={track} data-testid="ct-track">
        {TOPIC_SLIDES.map((t, i) => {
          const isCurrent = i === index
          return (
            <article
              key={t.id}
              className={`ct-slide k-${t.kind}${t.later ? ' later' : ''}${isCurrent ? ' is-current' : ''}${i < index ? ' is-before' : ''}`}
              data-i={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${t.name}`}
              aria-hidden={isCurrent ? undefined : true}
              onClick={(event) => onSlideClick(event, i)}
            >
              <TopicScene kind={t.kind} active={isCurrent} histogram={t.kind === 'stats' ? histogram : null} />
              {/* a slide waiting on the left shows its name at its right edge, the edge that peeks into view */}
              <span className="ct-peek" aria-hidden="true">{t.name}</span>
              <div className="ct-body">
                <h2>{t.name}</h2>
                <p className="ct-does">{t.does}</p>
                {t.subs && <p className="ct-subs">{t.subs}</p>}
                <div className="ct-needs">
                  <span>{t.needs}</span>
                  {!t.later && fitFor(t)}
                </div>
                {t.later ? (
                  <span className="ct-later">Coming later</span>
                ) : (
                  <a
                    className="hm-btn hm-btn-primary ct-go"
                    href={`#${t.id}`}
                    tabIndex={isCurrent ? 0 : -1}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                      event.preventDefault()
                      onNavigate(t.id)
                    }}
                  >
                    Open {t.name}<ChevR />
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <button ref={prevButton} type="button" className="ct-nav prev" aria-label="Previous topic" disabled={index === 0} onClick={() => { go(index - 1); if (index - 1 === 0) nextButton.current?.focus() }}><ChevL /></button>
      <button ref={nextButton} type="button" className="ct-nav next" aria-label="Next topic" disabled={index === count - 1} onClick={() => { go(index + 1); if (index + 1 === count - 1) prevButton.current?.focus() }}><ChevR /></button>
      <div className="ct-tabs" role="group" aria-label="Choose a topic">
        {TOPIC_SLIDES.map((t, i) => (
          <button key={t.id} type="button" className="ct-tab" aria-current={i === index ? 'true' : undefined} onClick={() => go(i)}>
            <span className="ct-dot" aria-hidden="true" />{t.name}
          </button>
        ))}
      </div>
      <p className="ct-hint">New to statistics? Probability needs no data, so it’s an easy place to start.</p>
      <p className="hm-sr" aria-live="polite" data-testid="ct-live">{announcement}</p>
    </section>
  )
}
