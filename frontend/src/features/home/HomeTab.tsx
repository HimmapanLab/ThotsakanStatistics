/**
 * The front page: the name, one line about the loaded data, a peek carousel of the four topics, and the partner
 * logos. It never moves on its own. The wording of the topics is in content/topics.ts.
 * REBUILD-HANDOFF rows 9 and 10.
 */
import { useCallback, useState } from 'react'
import { ROUTES, type Route } from '../../app/routes'
import { APP_NAME, ROUTE_NAMES, type TopicSlide } from '../../content/topics'
import { useData } from '../../context/DataContext'
import { useDrawer } from '../../context/DrawerContext'
import { formatCount } from '../../utils/formatNumber'
import TopicCarousel from './TopicCarousel'
import { useLoadedHistogram } from './useLoadedHistogram'
import './home.css'

interface HomeTabProps {
  onNavigate: (route: Route) => void
}

/** The page the reader was last on. The route store keeps only the current page, so Home keeps its own copy. */
const LAST_KEY = 'tsl.home.last'

function readKey(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function isTopic(value: string | null): value is Route {
  return !!value && value !== 'home' && (ROUTES as readonly string[]).includes(value)
}

function lastTopic(): Route | null {
  // The route store writes 'home' once this page shows, but not before this first render: read the page before it.
  const route = readKey('tsl.route')
  if (isTopic(route)) {
    try { localStorage.setItem(LAST_KEY, route) } catch { /* not remembered */ }
    return route
  }
  const own = readKey(LAST_KEY)
  return isTopic(own) ? own : null
}

const CheckIcon = () => (
  <svg className="hm-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9" /></svg>
)

export default function HomeTab({ onNavigate }: HomeTabProps) {
  const { state, restoring } = useData()
  const drawer = useDrawer()
  const histogram = useLoadedHistogram()
  const [last] = useState(lastTopic)

  const dataset = state.dataset
  const hasNumeric = state.numericCols.length > 0
  const hasGroups = state.categoricalCols.length > 0

  /** What a slide says about the loaded data: a short line, kept honest by what the columns allow. */
  const fitFor = useCallback((slide: TopicSlide) => {
    if (slide.kind === 'prob') return <span className="ct-fit none">Works without data</span>
    if (!dataset) return <span className="ct-fit no">Needs data</span>
    if (!hasNumeric) return <span className="ct-fit no">No Continuous column in this data</span>
    if (slide.kind === 'stats' || hasGroups) return <span className="ct-fit yes"><CheckIcon />{state.filename} fits</span>
    return <span className="ct-fit yes"><CheckIcon />Fits the one-sample tests</span>
  }, [dataset, hasNumeric, hasGroups, state.filename])

  // Data lives in the drawer of the topic pages, so Change data opens a topic page with the drawer open.
  const openData = () => {
    drawer.setOpen(true)
    onNavigate('statistics-graphical')
  }

  return (
    <div className="hm-page">
      <main className="hm" aria-label={APP_NAME}>
        <header className="hm-brand">
          <img className="hm-mask" src="/home/thotsakan-mask-640.webp" alt="" draggable={false} />
          <div className="hm-id">
            <h1 tabIndex={-1}>{APP_NAME}</h1>
            <p className="hm-promise">Pick a topic. Every number comes with its formula.</p>
            <p className="hm-data">
              {restoring
                ? <span>Bringing back your data…</span>
                : dataset
                  ? <span>Data: <strong>{state.filename}</strong> · {formatCount(dataset.rows.length)} rows × {formatCount(dataset.headers.length)} columns</span>
                  : <span>No data loaded.</span>}
              <button type="button" className="hm-btn hm-btn-quiet" onClick={openData}>{dataset ? 'Change data' : 'Load data'}</button>
              {last && (
                <a
                  className="hm-btn hm-btn-quiet"
                  href={`#${last}`}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                    event.preventDefault()
                    onNavigate(last)
                  }}
                >
                  Continue: {ROUTE_NAMES[last]}
                </a>
              )}
            </p>
          </div>
        </header>

        <TopicCarousel onNavigate={onNavigate} fitFor={fitFor} histogram={histogram} />

        <div className="hm-logos">
          <img src="/home/himmapan-112.png" alt="Himmapan" />
          <img src="/home/cmkl-96.png" alt="CMKL" />
          <img src="/home/aice-96.png" alt="AICE" />
          <span className="hm-sibling">
            <img src="/home/maiyarap-192.webp" alt="Maiyarap Equations" />
            <span>Sibling product: Maiyarap Equations (coming soon)</span>
          </span>
        </div>
      </main>
    </div>
  )
}
