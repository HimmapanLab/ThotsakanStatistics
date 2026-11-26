// lib/haptics.ts
// Vibration on phones and tablets: a progressive extra. The app works the same without it, and iPhones
// (Safari has no Vibration API) get none. Components call only `haptic(kind)`. REBUILD-HANDOFF, "Haptic feedback".
//
// A buzz happens only when all of these hold:
// - the browser has `navigator.vibrate`;
// - the Preferences switch "Vibration" is on (default on);
// - the last input was a touch, and it was recent, so automatic updates, page load and self-running tours
//   never buzz;
// - at least 80 ms since the last buzz, and no more than 3 buzzes in a row.

export type HapticKind = 'tick' | 'step' | 'confirm' | 'refuse' | 'detent'

/** Vibration patterns in milliseconds. */
export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8, // the carousel snaps to a new slide
  step: 12, // a new input step unlocks
  confirm: [10, 40, 10], // dataset loaded, or a filter applied
  refuse: [30, 50, 30], // a greyed-out option tapped, or a value rejected (always next to a visible reason)
  detent: 5, // a slider passes a snap point
}

export const VIBRATION_KEY = 'thotsakan-vibration'
const MIN_GAP_MS = 80
const MAX_IN_A_ROW = 3
/** Buzzes closer together than this count as one run. */
const RUN_GAP_MS = 400
/** A buzz must follow the touch that caused it within this time. */
const TOUCH_WINDOW_MS = 1000

let lastInputWasTouch = false
let lastTouchAt = -Infinity
let lastBuzzAt = -Infinity
let inARow = 0
let tracking = false
let now: () => number = () => performance.now()

function onPointerDown(event: Event) {
  lastInputWasTouch = (event as PointerEvent).pointerType === 'touch'
  if (lastInputWasTouch) lastTouchAt = now()
}

/** A finger still dragging (a slider, a swipe) keeps its touch recent. */
function onPointerMove(event: Event) {
  if ((event as PointerEvent).pointerType === 'touch' && lastInputWasTouch) lastTouchAt = now()
}

/** Follow the kind of the last input. Called once at start-up; safe to call again. */
export function trackInput(): void {
  if (tracking || typeof window === 'undefined') return
  tracking = true
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
}

/** Whether this device can vibrate and has a touch screen: the Preferences switch shows only then. */
export function vibrationSupported(): boolean {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function vibrationEnabled(): boolean {
  try {
    return localStorage.getItem(VIBRATION_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setVibrationEnabled(on: boolean): void {
  try { localStorage.setItem(VIBRATION_KEY, on ? 'on' : 'off') } catch { /* kept for this visit only */ }
}

/** Vibrate for a direct touch action. Returns whether it buzzed. */
export function haptic(kind: HapticKind): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  if (!vibrationEnabled() || !lastInputWasTouch) return false
  const t = now()
  if (t - lastTouchAt > TOUCH_WINDOW_MS) return false
  if (t - lastBuzzAt < MIN_GAP_MS) return false
  inARow = t - lastBuzzAt > RUN_GAP_MS ? 1 : inARow + 1
  if (inARow > MAX_IN_A_ROW) return false
  lastBuzzAt = t
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[kind])
  } catch {
    return false
  }
}

/** For tests: forget every input and buzz, and optionally replace the clock. */
export function resetHaptics(clock?: () => number): void {
  lastInputWasTouch = false
  lastTouchAt = -Infinity
  lastBuzzAt = -Infinity
  inARow = 0
  now = clock ?? (() => performance.now())
}
