// The Preferences sheet: appearance, text size, display precision, vibration and the tour.
// Prototype: sheetHtml, setText, syncSheet.
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../context/DataContext'
import { setVibrationEnabled, vibrationEnabled, vibrationSupported } from '../lib/haptics'
import { PRECISION_MAX, PRECISION_MIN } from '../utils/formatNumber'
import { CloseIcon } from '../layout/icons'

// ── Text size ────────────────────────────────────────────────────────────────

export type TextSize = 'standard' | 'large' | 'projector'
export const TEXT_KEY = 'tsl.text'
const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
  { value: 'projector', label: 'Projector' },
]

export function readTextSize(): TextSize {
  try {
    const saved = localStorage.getItem(TEXT_KEY)
    return saved === 'large' || saved === 'projector' ? saved : 'standard'
  } catch {
    return 'standard'
  }
}

/** Put the size on the page: the root font size follows html[data-text] (design/tokens.css). */
export function applyTextSize(size: TextSize): void {
  const root = document.documentElement
  if (size === 'standard') root.removeAttribute('data-text')
  else root.setAttribute('data-text', size)
}

export function setTextSize(size: TextSize): void {
  applyTextSize(size)
  try { localStorage.setItem(TEXT_KEY, size) } catch { /* kept for this visit only */ }
}

// The saved size is on the page before the first paint.
if (typeof document !== 'undefined') applyTextSize(readTextSize())

// ── The sheet ────────────────────────────────────────────────────────────────

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange?: (value: T) => void
}) {
  return (
    <div className="sh-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" disabled={option.disabled} aria-pressed={option.value === value}
          onClick={() => onChange?.(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface SettingsProps {
  open: boolean
  onClose: () => void
  /** "Replay the tour": the app closes the sheet and starts the tour. */
  onReplayTour: () => void
}

export default function Settings({ open, onClose, onReplayTour }: SettingsProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const { state, setPrecision } = useData()
  const [text, setText] = useState<TextSize>(readTextSize)
  const [vibration, setVibration] = useState(vibrationEnabled)
  const canVibrate = open && vibrationSupported()

  // Focus goes into the sheet, and back to where it came from when the sheet closes.
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    setText(readTextSize())
    setVibration(vibrationEnabled())
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      const back = opener.current
      opener.current = null
      if (back?.isConnected) back.focus({ preventScroll: true })
      else document.querySelector<HTMLElement>('a[href="#preferences"]')?.focus({ preventScroll: true })
    }
  }, [open])

  // Esc closes the sheet; Tab stays inside it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const sheet = sheetRef.current
      if (!sheet) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, a[href]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!sheet.contains(active)) { first.focus(); event.preventDefault() }
      else if (event.shiftKey && (active === first || active === sheet)) { last.focus(); event.preventDefault() }
      else if (!event.shiftKey && active === last) { first.focus(); event.preventDefault() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const version = import.meta.env.VITE_APP_VERSION as string | undefined

  return createPortal(
    <>
      <div className="sh-scrim" onClick={onClose} />
      <section ref={sheetRef} className="sh-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sh-sheet-head">
          <h2 id={titleId}>Preferences</h2>
          <button ref={closeRef} type="button" className="sh-btn sh-btn-quiet sh-btn-icon" aria-label="Close Preferences" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="sh-sheet-body">
          <div className="sh-pref">
            <span className="sh-pref-name">Appearance</span>
            <Segmented label="Appearance" value="light" options={[
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'Match system', disabled: true },
              { value: 'dark', label: 'Dark', disabled: true },
            ]} />
            <span className="sh-pref-help">Dark comes later.</span>
          </div>

          <div className="sh-pref">
            <span className="sh-pref-name">Text size</span>
            <Segmented label="Text size" value={text} options={TEXT_SIZES}
              onChange={(size) => { setTextSize(size); setText(size) }} />
            <span className="sh-pref-help">Projector also thickens plot lines.</span>
          </div>

          <div className="sh-pref">
            <label className="sh-pref-name" htmlFor={`${titleId}-precision`}>Display precision</label>
            <select id={`${titleId}-precision`} className="sh-select" value={state.displayPrecision}
              onChange={(event) => setPrecision(Number(event.target.value))}>
              {Array.from({ length: PRECISION_MAX - PRECISION_MIN + 1 }, (_, i) => PRECISION_MIN + i).map((p) => (
                <option key={p} value={p}>{p} decimal places</option>
              ))}
            </select>
            <span className="sh-pref-help">Every table and plot shows this many decimals. A tiny value that would round to zero shows in scientific notation.</span>
          </div>

          {canVibrate && (
            <div className="sh-pref">
              <span className="sh-pref-name" id={`${titleId}-vibration`}>Vibration</span>
              <button type="button" role="switch" className="sh-switch" aria-checked={vibration} aria-labelledby={`${titleId}-vibration`}
                onClick={() => { setVibrationEnabled(!vibration); setVibration(!vibration) }} />
              <span className="sh-pref-help">A short buzz when you tap to change slides, unlock a step or load data.</span>
            </div>
          )}

          <div className="sh-pref">
            <span className="sh-pref-name">Tour</span>
            <button type="button" className="sh-btn" onClick={onReplayTour}>Replay the tour</button>
          </div>
          {version && <p className="sh-version">Thotsakan Statistics v{version}</p>}
        </div>
      </section>
    </>,
    document.body,
  )
}
