import { useState, Suspense, lazy, useMemo, useCallback, useEffect, useRef } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
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
const CommonDistObservation = lazy(() => import('./features/probability/common/CommonDistObservation'))

// Lazy-loaded Descriptive Statistics panels (from composite DescriptiveTab)
import { useDescriptiveTabState } from './features/estimation/descriptive/useDescriptiveTabState'
const DescriptiveControlsSlot = lazy(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ControlsSlot })))
const DescriptiveObservationSlot = lazy(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ObservationSlot })))

// Lazy-loaded Statistical Inference panels
import { useInferenceTabState } from './features/estimation/inference/useInferenceTabState'
const InferenceControlsSlot = lazy(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ControlsSlot })))
const InferenceObservationSlot = lazy(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ObservationSlot })))

// Lazy-loaded Hypothesis Testing panels
import { useHypothesisTabState } from './features/hypothesis/useHypothesisTabState'
const HypothesisControlsSlot = lazy(() =>
  import('./features/hypothesis/HypothesisTab').then((m) => ({ default: m.ControlsSlot })))
const HypothesisObservationSlot = lazy(() =>
  import('./features/hypothesis/HypothesisTab').then((m) => ({ default: m.ObservationSlot })))

// Lazy-loaded Graphical Analysis panels
import { useGraphicalTabState } from './features/estimation/graphical/useGraphicalTabState'
import { loadPageState, useSavePageState } from './lib/pageState'
const GraphicalControlsSlot = lazy(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ControlsSlot })))
const GraphicalObservationSlot = lazy(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ObservationSlot })))

function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
      Loading chart…
    </div>
  )
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 mx-auto max-w-2xl text-center">
      <div className="border border-[var(--error)] bg-[var(--error-bg)] rounded-xl p-8 w-full">
        <h2 className="text-2xl font-bold text-[var(--error)] mb-4 flex justify-center items-center gap-2">
          <span className="text-3xl">⚠️</span> Something went wrong
        </h2>
        <div className="text-sm text-left w-full overflow-auto max-h-64 bg-[var(--field)] border border-[var(--line)] p-4 rounded-lg mb-6">
          <pre className="font-mono text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
            {error.name}: {error.message}
          </pre>
          {error.stack && (
            <pre className="mt-4 pt-4 border-t border-[var(--line)] font-mono text-[var(--ink-muted)] text-xs whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
        <button
          onClick={resetErrorBoundary}
          className="px-6 py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--ground)] focus:ring-[var(--color-primary)]"
        >
          Recover and Restart
        </button>
      </div>
    </div>
  )
}

/** The pages that sit on the bench: everything but the front page and the "Coming later" page. */
function isBenchRoute(route: Route): boolean {
  return route !== 'home' && route !== 'regression'
}

/** The first Statistics page: where "Take the tour" goes when the reader is on a page with nothing to tour. */
const TOUR_PAGE: Route = 'statistics-graphical'

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [route, setRoute] = useHashRoute()
  const [prefsOpen, setPrefsOpen] = usePreferencesOpen()
  const { open: drawerOpen, setOpen: setDrawerOpen } = useDrawer()

  // Data opens next to the page you are on; moving to another page closes it.
  useEffect(() => { setDrawerOpen(false) }, [route, setDrawerOpen])

  // A new page is named in the tab title, starts at the top, and has focus on its heading for screen readers.
  const firstRoute = useRef(true)
  useEffect(() => {
    document.title = route === 'home' ? APP_NAME : `${pageTitle(route)} · ${APP_NAME}`
    if (firstRoute.current) { firstRoute.current = false; return }
    window.scrollTo?.(0, 0)
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route])

  // ── The tour ────────────────────────────────────────────────────────────────
  const [tourOpen, setTourOpen] = useState(false)
  const pendingTour = useRef(false)
  const autoOffered = useRef(false)
  const routeRef = useRef(route)
  routeRef.current = route

  const startTour = useCallback(() => {
    if (isBenchRoute(routeRef.current)) {
      setDrawerOpen(false)
      setTourOpen(true)
    } else {
      // The front page has no inputs to point at: go to a page that has, and start there.
      pendingTour.current = true
      setRoute(TOUR_PAGE)
    }
  }, [setDrawerOpen, setRoute])

  useEffect(() => {
    if (!isBenchRoute(route) || prefsOpen) return
    if (pendingTour.current) {
      pendingTour.current = false
      setTourOpen(true)
    } else if (!autoOffered.current && !tourOpen && !drawerOpen && !tourSeen()) {
      // First visit to a page with inputs: offer the tour once
      autoOffered.current = true
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
  const firstDiscrete = DISTRIBUTIONS.find((d) => d.type === 'discrete')!
  // The distribution, parameters and query from before a refresh, when they still name a known distribution.
  const [savedProb] = useState(() => {
    const saved = loadPageState<{ modelType: 'discrete' | 'continuous'; distName: string; paramValues: Record<string, number>; query: DistQuery }>('probability', '*')
    const dist = saved && DISTRIBUTIONS.find((d) => d.name === saved.distName)
    return dist && saved.paramValues && saved.query && dist.params.every((p) => typeof saved.paramValues![p.key] === 'number')
      ? { modelType: dist.type as 'discrete' | 'continuous', distName: dist.name, paramValues: saved.paramValues, query: saved.query }
      : null
  })
  const [probModelType, setProbModelType] = useState<'discrete' | 'continuous'>(savedProb?.modelType ?? 'discrete')
  const [probDistName, setProbDistName] = useState(savedProb?.distName ?? firstDiscrete.name)
  const [probParamValues, setProbParamValues] = useState<Record<string, number>>(
    savedProb?.paramValues ?? Object.fromEntries(firstDiscrete.params.map((p) => [p.key, p.default]))
  )
  const [probQuery, setProbQuery] = useState<DistQuery>(() => savedProb?.query ?? defaultQuery(firstDiscrete.name, probParamValues))
  useSavePageState('probability', '*', { modelType: probModelType, distName: probDistName, paramValues: probParamValues, query: probQuery })

  const probDistParams = useMemo(() => ({
    distName: probDistName,
    paramValues: probParamValues,
    query: probQuery,
  }), [probDistName, probParamValues, probQuery])

  const { result: probResult, isLoading: probLoading, error: probError, retry: probRetry, appliedParams: probAppliedParams } = useDistribution(probDistParams)
  const { state: dataState } = useData()

  function handleDistChange(name: string) {
    const dist = DISTRIBUTIONS.find((d) => d.name === name)!
    const defaults = Object.fromEntries(dist.params.map((p) => [p.key, p.default]))
    setProbDistName(name)
    setProbParamValues(defaults)
    // A query for another distribution may lie outside this one's support (x = 5 for a Beta).
    setProbQuery((query) => defaultQuery(name, defaults, query))
  }

  function handleModelTypeChange(t: 'discrete' | 'continuous') {
    setProbModelType(t)
    const first = DISTRIBUTIONS.find((d) => d.type === t)!
    handleDistChange(first.name)
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
        modelType={probModelType}
        distName={probDistName}
        paramValues={probParamValues}
        query={probQuery}
        onModelTypeChange={handleModelTypeChange}
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
          setProbQuery(defaultQuery(probDistName, defaults))
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
            onReset={() => setRoute('home')}
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
