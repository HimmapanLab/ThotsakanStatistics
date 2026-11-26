import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HAPTIC_PATTERNS, haptic, resetHaptics, setVibrationEnabled, trackInput, vibrationSupported } from './haptics'

let t = 0
let vibrate: ReturnType<typeof vi.fn>

function press(pointerType: 'touch' | 'mouse' | 'pen') {
  const event = new Event('pointerdown', { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  window.dispatchEvent(event)
}
function drag(pointerType: 'touch' | 'mouse') {
  const event = new Event('pointermove', { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  window.dispatchEvent(event)
}

beforeEach(() => {
  t = 1000
  resetHaptics(() => t)
  vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrate })
  trackInput()
})
afterEach(() => {
  delete (navigator as { vibrate?: unknown }).vibrate
})

describe('haptic', () => {
  it('vibrates with the pattern of each kind after a touch', () => {
    for (const kind of Object.keys(HAPTIC_PATTERNS) as (keyof typeof HAPTIC_PATTERNS)[]) {
      t += 1000
      press('touch')
      expect(haptic(kind)).toBe(true)
      expect(vibrate).toHaveBeenLastCalledWith(HAPTIC_PATTERNS[kind])
    }
    expect(HAPTIC_PATTERNS).toEqual({ tick: 8, step: 12, confirm: [10, 40, 10], refuse: [30, 50, 30], detent: 5 })
  })

  it('never vibrates for a mouse or a pen', () => {
    press('mouse')
    expect(haptic('tick')).toBe(false)
    press('pen')
    expect(haptic('confirm')).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('never vibrates while the Vibration switch is off', () => {
    setVibrationEnabled(false)
    press('touch')
    expect(haptic('tick')).toBe(false)
    setVibrationEnabled(true)
    expect(haptic('tick')).toBe(true)
  })

  it('never vibrates on page load or an automatic update long after the last touch', () => {
    expect(haptic('confirm')).toBe(false) // no input yet: page load
    press('touch')
    t += 1500 // the result recalculated on its own later
    expect(haptic('step')).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('keeps a long drag alive, so a slider still ticks', () => {
    press('touch')
    t += 900; drag('touch')
    t += 900
    expect(haptic('detent')).toBe(true)
  })

  it('buzzes at most once per 80 ms and never more than 3 times in a row', () => {
    press('touch')
    expect(haptic('detent')).toBe(true)
    t += 50; drag('touch')
    expect(haptic('detent')).toBe(false) // under 80 ms
    t += 40; drag('touch')
    expect(haptic('detent')).toBe(true)
    t += 90; drag('touch')
    expect(haptic('detent')).toBe(true)
    t += 90; drag('touch')
    expect(haptic('detent')).toBe(false) // a fourth in a row
    t += 500; drag('touch')
    expect(haptic('detent')).toBe(true) // after a pause, a new run
    expect(vibrate).toHaveBeenCalledTimes(4)
  })

  it('does nothing where the browser has no Vibration API (iPhone)', () => {
    delete (navigator as { vibrate?: unknown }).vibrate
    press('touch')
    expect(haptic('tick')).toBe(false)
    expect(vibrationSupported()).toBe(false)
  })
})
