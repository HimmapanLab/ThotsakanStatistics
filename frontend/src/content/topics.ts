// content/topics.ts
// The names and descriptions of the topics, for the top bar menu, the page head and the front page slides.
// DRAFT FOR IRVING: the wording is copied from the approved prototype (TOPIC_SLIDES, STATS_SUB). Names of topics
// and statistics are his; change the words here and nowhere else.
import type { Route, StatsRoute } from '../app/routes'

/** The name of each page, as the top bar and the page title show it. */
export const ROUTE_NAMES: Record<Route, string> = {
  home: 'Home',
  probability: 'Probability',
  'statistics-graphical': 'Graphical Analysis',
  'statistics-descriptive': 'Descriptive Statistics',
  'statistics-inference': 'Statistical Inference',
  hypothesis: 'Hypothesis Testing',
  'regression': 'Linear Regression',
}

/** The product name, in the top bar and the page title. */
export const APP_NAME = 'Thotsakan Statistics'

/** The three sub-topics of Statistics: the topic menu and the carousel slide list them. */
export const STATS_SUB_TOPICS: readonly { route: StatsRoute; name: string; description: string }[] = [
  { route: 'statistics-graphical', name: 'Graphical Analysis', description: 'Plot one variable: histogram or ECDF, with curves on top.' },
  { route: 'statistics-descriptive', name: 'Descriptive Statistics', description: 'Summarise it: centre, spread and shape.' },
  { route: 'statistics-inference', name: 'Statistical Inference', description: 'Put confidence and prediction intervals on it.' },
]

/** The topics of the top bar. Statistics opens the menu of its sub-topics, so its route is its first sub-topic. */
export const TOP_BAR_TOPICS: readonly { route: Route; name: string; hasMenu?: boolean }[] = [
  { route: 'probability', name: 'Probability' },
  { route: 'statistics-graphical', name: 'Statistics', hasMenu: true },
  { route: 'hypothesis', name: 'Hypothesis Testing' },
  { route: 'regression', name: 'Linear Regression' },
]

export type TopicKind = 'prob' | 'stats' | 'hyp' | 'reg'

export interface TopicSlide {
  /** The page the slide opens. */
  id: Route
  name: string
  /** Names the scene drawn on the slide. */
  kind: TopicKind
  /** What the topic does, in one sentence. */
  does: string
  /** The sub-topics, for Statistics only. */
  subs?: string
  /** What data the topic needs. */
  needs: string
  /** The page is only a "Coming later" notice. */
  later?: boolean
}

/** The front page slides, in order. */
export const TOPIC_SLIDES: readonly TopicSlide[] = [
  { id: 'probability', name: 'Probability', kind: 'prob', does: 'Find the chance of an outcome for a common distribution.', needs: 'Needs: no data' },
  { id: 'statistics-graphical', name: 'Statistics', kind: 'stats', does: 'Look at one variable, summarise it, and put intervals on it.', subs: 'Graphical Analysis · Descriptive Statistics · Statistical Inference', needs: 'Needs: one Continuous column' },
  { id: 'hypothesis', name: 'Hypothesis Testing', kind: 'hyp', does: 'Test a claim about a mean, or compare two groups.', needs: 'Needs: a Continuous column and a group column' },
  { id: 'regression', name: 'Linear Regression', kind: 'reg', does: 'Model one variable from another.', needs: 'Needs: two Continuous columns', later: true },
]

/** The page head: the small "Statistics ›" line above the title, for the Statistics pages only. */
export function pageCrumb(route: Route): string | null {
  return route.startsWith('statistics-') ? 'Statistics' : null
}

/** The title of a page. */
export function pageTitle(route: Route): string {
  return ROUTE_NAMES[route]
}

/**
 * Step gating: the names of the steps after "Data", shown as faint headers until a variable is picked.
 * Probability needs no data, so it has no locked steps.
 */
export const LOCKED_STEPS: Partial<Record<Route, readonly string[]>> = {
  'statistics-graphical': ['What to show', 'Settings'],
  'statistics-descriptive': ['What to show', 'Settings'],
  'statistics-inference': ['What to show', 'Settings'],
  hypothesis: ['Test', 'Settings'],
}
