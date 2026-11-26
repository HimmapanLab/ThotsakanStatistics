// layout/benchLayout.ts
// Widths of the bench's resizable panels: the inputs and the Data drawer (whichever is open sits between the rail
// and the results). Limits follow the approved prototype (LAY_LIM, OUTPUT_MIN in app.js); the reader's widths are
// kept per browser under 'tsl.layout', the prototype's key.

export type PanelKind = 'inputs' | 'drawer'

export const PANEL_LIMITS: Record<PanelKind, { min: number; max: number; def: number }> = {
  inputs: { min: 260, max: 480, def: 320 },
  drawer: { min: 300, max: 960, def: 580 },
}

/** The results never get narrower than this, at the standard 14 px text (it grows with the text size). */
export const RESULTS_MIN_REM = 30

export const LAYOUT_KEY = 'tsl.layout'

export interface PanelWidths { inputs: number; drawer: number }

export function loadWidths(): PanelWidths {
  const widths = { inputs: PANEL_LIMITS.inputs.def, drawer: PANEL_LIMITS.drawer.def }
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null') as { inW?: unknown; drW?: unknown } | null
    if (saved && typeof saved.inW === 'number' && Number.isFinite(saved.inW)) widths.inputs = saved.inW
    if (saved && typeof saved.drW === 'number' && Number.isFinite(saved.drW)) widths.drawer = saved.drW
  } catch { /* a bad stored value: the defaults */ }
  return widths
}

export function saveWidths(widths: PanelWidths): void {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as Record<string, unknown>
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ ...saved, inW: Math.round(widths.inputs), drW: Math.round(widths.drawer) }))
  } catch { /* kept for this visit only */ }
}

/**
 * The range a panel can take on a bench this wide: its own limits, and never so wide that the results drop
 * under their minimum. `room` is the bench width minus the rail; `resultsMin` is in px.
 */
export function panelRange(kind: PanelKind, room: number, resultsMin: number): { min: number; max: number } {
  const { min, max } = PANEL_LIMITS[kind]
  return { min, max: Math.max(min, Math.min(max, room - resultsMin)) }
}

export function clampWidth(kind: PanelKind, width: number, room: number, resultsMin: number): number {
  const { min, max } = panelRange(kind, room, resultsMin)
  return Math.round(Math.min(max, Math.max(min, width)))
}
