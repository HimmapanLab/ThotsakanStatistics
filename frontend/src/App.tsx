import { useState, Suspense, lazy, useMemo, useCallback, useEffect, useRef } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorFallback } from './app/ErrorFallback'
import { withRetry } from './app/lazyRetry'
import Header from './layout/Header'
import LabBench from './layout/LabBench'
import { NoDataState, NoNumericState, LoadingDataState } from './layout/EmptyStates'
import './layout/shell.css'
import { useHashRoute, usePreferencesOpen, type Route } from './app/routes'
import { APP_NAME, pageTitle } from './content/topics'
import HomeTab from './features/home/HomeTab'
import ComingLater from './features/later/ComingLater'
import Settings from './components/Settings'
import Tour, { forgetTourSeen, markTourSeen, tourSeen } from './components/Tour'
import { useDrawer } from './context/DrawerContext'
import { useOpenDrawerOnNotice } from './features/data/useOpenDrawerOnNotice'

// ── Probability: Common Distributions ────────────────────────────────────────
import CommonDistControls from './features/probability/common/CommonDistControls'
import { useData } from './context/DataContext'
import {
  useDistribution,
  DISTRIBUTIONS,
  clampParams,
} from './hooks/useDistribution'
import type { DistQuery } from './math/probabilityQuery'
import { queryDomain } from './math/localDistributions'
import { clampQuery, defaultQuery } from './math/queryDomain'

// Lazy-loaded heavy chart components
const CommonDistObservation = lazy(withRetry(() => import('./features/probability/common/CommonDistObservation')))

// Lazy-loaded Descriptive Statistics panels (from composite DescriptiveTab)
import { useDescriptiveTabState } from './features/estimation/descriptive/useDescriptiveTabState'
const DescriptiveControlsSlot = lazy(withRetry(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ControlsSlot }))))
const DescriptiveObservationSlot = lazy(withRetry(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ObservationSlot }))))

// Lazy-loaded Statistical Inference panels
import { useInferenceTabState } from './features/estimation/inference/useInferenceTabState'
const InferenceControlsSlot = lazy(withRetry(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ControlsSlot }))))
const InferenceObservationSlot = lazy(withRetry(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ObservationSlot }))))

// Lazy-loaded Hypothesis Testing panels
import { useHypothesisTabState } from './features/hypothesis/useHypothesisTabState'
const HypothesisControlsSlot = lazy(withRetry(() =>
  import('./features/hypothesis/HypothesisTab').then((m) => ({ default: m.ControlsSlot }))))
const HypothesisObservationSlot = lazy(withRetry(() =>
  import('./features/hypothesis/HypothesisTab').then((m) => ({ default: m.ObservationSlot }))))

// Lazy-loaded Graphical Analysis panels
import { useGraphicalTabState } from './features/estimation/graphical/useGraphicalTabState'
import { loadPageState, useSavePageState } from './lib/pageState'
const GraphicalControlsSlot = lazy(withRetry(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ControlsSlot }))))
const GraphicalObservationSlot = lazy(withRetry(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ObservationSlot }))))

function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
      Loading chart…
    </div>
  )
}

/** The pages that sit on the bench: everything but the front page and the "Coming later" page. */
function isBenchRoute(route: Route): boolean {
  return route !== 'home' && route !== 'regression'
}

/** The interval the Probability page opens with; defaultQuery puts it one standard deviation each side of the mean. */
const OPENING_QUERY: DistQuery = { kind: 'interval', lower: 0, lowerOp: '<=', upper: 0, upperOp: '<=' }

/** The first Statistics page: where "Take the tour" goes when the reader is on a page with nothing to tour. */
const TOUR_PAGE: Route = 'statistics-graphical'

// ─── App ────────────────────────────────────────────────────────────────────

/**
 * After a refresh the data from last time is brought back first. Until then the page shows the shell (header,
 * front page, Preferences) and a line of its own, not a blank app. The pages' inputs are restored when they mount
 * (lib/pageState), so they mount only once the data is there: <Workspace> below.
 */
export default function App() {
  const { restoring } = useData()
  return restoring ? <RestoringShell /> : <Workspace />
}

function RestoringShell() {
  const [route, setRoute] = useHashRoute()
  const [prefsOpen, setPrefsOpen] = usePreferencesOpen()
  const noTour = useCallback(() => {}, [])
  return (
    <div className="app-root">
      <div className="app-main" inert={prefsOpen}>
        <Header route={route} onTour={noTour} />
        <div className="app-stage">
          {route === 'home' ? <HomeTab onNavigate={setRoute} /> : <LoadingDataState />}
        </div>
      </div>
      <Settings open={prefsOpen} onClose={() => setPrefsOpen(false)} onReplayTour={noTour} />
    </div>
  )
}

function Workspace() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [route, setRoute] = useHashRoute()
  const [prefsOpen, setPrefsOpen] = usePreferencesOpen()
  const { open: drawerOpen, setOpen: setDrawerOpen } = useDrawer()

  // Data opens next to the page you are on; moving to another page closes it. Arriving from the front page (or
  // the "Coming later" page) keeps it open, because "Load data" there asks for the drawer on the page it opens.
  const previousRoute = useRef<Route | null>(null)
  useEffect(() => {
    if (previousRoute.current === null || isBenchRoute(previousRoute.current)) setDrawerOpen(false)
    previousRoute.current = route
  }, [route, setDrawerOpen])

  // A new page is named in the tab title, starts at the top, and has focus on its heading for screen readers.
  const firstRoute = useRef(true)
  useEffect(() => {
    document.title = route === 'home' ? APP_NAME : `${pageTitle(route)} · ${APP_NAME}`
    if (firstRoute.current) { firstRoute.current = false; return }
    window.scrollTo?.(0, 0)
    const frame = window.requestAnimationFrame(() => {
      // The Data drawer opened with the page ("Load data" on the front page) has already taken the focus.
      if (document.activeElement?.closest('.bench-drawer')) return
      // The tour or Preferences opened with the page: focus stays on its card.
      if (document.activeElement?.closest('.tour-coach, .sh-sheet')) return
      document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route])

  // ── The tour ────────────────────────────────────────────────────────────────
  const [tourOpen, setTourOpen] = useState(false)
  const pendingTour = useRef(false)
  /** The page the open tour started on. */
  const tourRoute = useRef<Route | null>(null)
  const autoOffered = useRef(false)
  const routeRef = useRef(route)
  routeRef.current = route

  const startTour = useCallback(() => {
    if (isBenchRoute(routeRef.current)) {
      setDrawerOpen(false)
      tourRoute.current = routeRef.current
      setTourOpen(true)
    } else {
      // The front page has no inputs to point at: go to a page that has, and start there.
      pendingTour.current = true
      setRoute(TOUR_PAGE)
    }
  }, [setDrawerOpen, setRoute])

  // The tour belongs to the page it started on: another page has other parts to point at, so it closes (not finished).
  useEffect(() => {
    if (tourOpen && tourRoute.current !== route) setTourOpen(false)
  }, [route, tourOpen])

  useEffect(() => {
    if (!isBenchRoute(route) || prefsOpen) return
    if (pendingTour.current) {
      pendingTour.current = false
      tourRoute.current = route
      setTourOpen(true)
    } else if (!autoOffered.current && !tourOpen && !drawerOpen && !tourSeen()) {
      // First visit to a page with inputs: offer the tour once
      autoOffered.current = true
      tourRoute.current = route
      setTourOpen(true)
    }
  }, [route, prefsOpen, tourOpen, drawerOpen])

  const endTour = useCallback((finished: boolean) => {
    setTourOpen(false)
    if (finished) markTourSeen()
  }, [])

  const replayTour = useCallback(() => {
    forgetTourSeen()
    setPrefsOpen(false)
    startTour()
  }, [setPrefsOpen, startTour])

  // ── Probability / Common Distributions state ───────────────────────────────
  // The page opens on Normal(0, 1) asking for P(−1 ≤ X ≤ 1), as the approved design does.
  const firstDist = DISTRIBUTIONS.find((d) => d.name === 'Normal')!
  // The distribution, parameters and query from before a refresh, when they still name a known distribution.
  const [savedProb] = useState(() => {
    const saved = loadPageState<{ modelType: 'discrete' | 'continuous'; distName: string; paramValues: Record<string, number>; query: DistQuery }>('probability', '*')
    const dist = saved && DISTRIBUTIONS.find((d) => d.name === saved.distName)
    return dist && saved.paramValues && saved.query && dist.params.every((p) => typeof saved.paramValues![p.key] === 'number')
      ? { modelType: dist.type as 'discrete' | 'continuous', distName: dist.name, paramValues: saved.paramValues, query: saved.query }
      : null
  })
  const [probModelType, setProbModelType] = useState<'discrete' | 'continuous'>(savedProb?.modelType ?? firstDist.type)
  const [probDistName, setProbDistName] = useState(savedProb?.distName ?? firstDist.name)
  const [probParamValues, setProbParamValues] = useState<Record<string, number>>(
    savedProb?.paramValues ?? Object.fromEntries(firstDist.params.map((p) => [p.key, p.default]))
  )
  const [probQuery, setProbQuery] = useState<DistQuery>(() => savedProb?.query ?? defaultQuery(firstDist.name, probParamValues, OPENING_QUERY))
  useSavePageState('probability', '*', { modelType: probModelType, distName: probDistName, paramValues: probParamValues, query: probQuery })

  const probDistParams = useMemo(() => ({
    distName: probDistName,
    paramValues: probParamValues,
    query: probQuery,
  }), [probDistName, probParamValues, probQuery])

  const { result: probResult, isLoading: probLoading, error: probError, retry: probRetry, appliedParams: probAppliedParams } = useDistribution(probDistParams)
  const { state: dataState } = useData()
  // Data that could not be brought back after a refresh: open the drawer, where its one line says why. Probability
  // has no drawer (it closes there at once), so the notice waits for a page that has one and, meanwhile, shows
  // on the Probability page itself (below).
  useOpenDrawerOnNotice(dataState.notice, isBenchRoute(route) && route !== 'probability', () => setDrawerOpen(true))

  function handleDistChange(name: string) {
    const dist = DISTRIBUTIONS.find((d) => d.name === name)!
    const defaults = Object.fromEntries(dist.params.map((p) => [p.key, p.default]))
    setProbModelType(dist.type)
    setProbDistName(name)
    setProbParamValues(defaults)
    // A query for another distribution may lie outside this one's support (x = 5 for a Beta).
    setProbQuery((query) => defaultQuery(name, defaults, query))
  }

  // ── Descriptive Statistics state ─────────────────────────────────────────
  const descriptive = useDescriptiveTabState()

  // ── Statistical Inference state ──────────────────────────────────────────
  const inference = useInferenceTabState()

  // ── Graphical Analysis state ─────────────────────────────────────────────
  const graphical = useGraphicalTabState()

  // ── Hypothesis Testing state ─────────────────────────────────────────────
  const hypothesis = useHypothesisTabState()

  // ── Slot content resolver ──────────────────────────────────────────────────
  let controls: React.ReactNode = null
  let observation: React.ReactNode = null

  if (route === 'probability') {
    controls = (
      <CommonDistControls
        distName={probDistName}
        paramValues={probParamValues}
        query={probQuery}
        onDistChange={handleDistChange}
        onParamChange={(key, val) => {
          const dist = DISTRIBUTIONS.find((entry) => entry.name === probDistName)!
          const values = clampParams(dist, { ...probParamValues, [key]: val })
          setProbParamValues(values)
          setProbQuery((query) => clampQuery(query, queryDomain(probDistName, values)))
        }}
        onQueryChange={setProbQuery}
        onReset={() => {
          const dist = DISTRIBUTIONS.find((entry) => entry.name === probDistName)!
          const defaults = Object.fromEntries(dist.params.map((param) => [param.key, param.default]))
          setProbParamValues(defaults)
          setProbQuery(defaultQuery(probDistName, defaults, probDistName === firstDist.name ? OPENING_QUERY : undefined))
        }}
      />
    )
    observation = (
      <Suspense fallback={<ChartFallback />}>
        <CommonDistObservation
          distParams={probDistParams}
          appliedParams={probAppliedParams}
          result={probResult}
          isLoading={probLoading}
          error={probError}
          onRetry={probRetry}
          precision={dataState.displayPrecision}
        />
      </Suspense>
    )
  } else if (route === 'statistics-graphical') {
    controls = <Suspense fallback={<ChartFallback />}><GraphicalControlsSlot state={graphical} /></Suspense>
    observation = <Suspense fallback={<ChartFallback />}><GraphicalObservationSlot state={graphical} /></Suspense>
  } else if (route === 'statistics-descriptive') {
    controls = <Suspense fallback={<ChartFallback />}><DescriptiveControlsSlot state={descriptive} /></Suspense>
    observation = <Suspense fallback={<ChartFallback />}><DescriptiveObservationSlot state={descriptive} /></Suspense>
  } else if (route === 'statistics-inference') {
    controls = <Suspense fallback={<ChartFallback />}><InferenceControlsSlot state={inference} /></Suspense>
    observation = <Suspense fallback={<ChartFallback />}><InferenceObservationSlot state={inference} /></Suspense>
  } else if (route === 'hypothesis') {
    controls = <Suspense fallback={<ChartFallback />}><HypothesisControlsSlot state={hypothesis} /></Suspense>
    observation = <Suspense fallback={<ChartFallback />}><HypothesisObservationSlot state={hypothesis} /></Suspense>
  }

  // Before there is anything to analyse the results say so, in place of the page's own results.
  // Probability needs no data.
  if (isBenchRoute(route) && route !== 'probability') {
    if (!dataState.dataset) observation = dataState.status === 'loading' ? <LoadingDataState /> : <NoDataState />
    else if (dataState.numericCols.length === 0) observation = <NoNumericState />
  }

  // The notice is read where there is no drawer to show it.
  if (route === 'probability' && dataState.notice) {
    observation = <>
      <p role="status" className="status-warning">{dataState.notice}</p>
      {observation}
    </>
  }

  let content: React.ReactNode
  if (route === 'home') content = <HomeTab onNavigate={setRoute} />
  else if (route === 'regression') content = <ComingLater onBack={() => setRoute('home')} />
  else content = <LabBench route={route} controls={controls} observation={observation} />

  return (
    <div className="app-root">
      {/* The page behind the Preferences sheet cannot be reached while the sheet is open. */}
      <div className="app-main" inert={prefsOpen}>
        <Header route={route} onTour={startTour} />
        <div className="app-stage">
          <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) => <ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />}
            onReset={(details) => {
              // Moving to another page only clears the error; Recover goes to the front page, or, when already
              // there with nowhere else to go, loads the app again.
              if (details.reason === 'keys') return
              if (routeRef.current === 'home') window.location.reload()
              else setRoute('home')
            }}
            resetKeys={[route]}
          >
            {content}
          </ErrorBoundary>
        </div>
      </div>
      <Settings open={prefsOpen} onClose={() => setPrefsOpen(false)} onReplayTour={replayTour} />
      <Tour open={tourOpen} onClose={endTour} />
    </div>
  )
}
