// features/data/TypeMenu.tsx
// The column type menu: five types, the current one marked. A type the values do not fit is greyed out with the
// reason shown under it. It is aria-disabled rather than disabled so the reason can be reached and read by keyboard,
// and a tap on it buzzes "no" (haptic refuse) next to the visible reason.
import { useId, type RefObject } from 'react'
import { useData } from '../../context/DataContext'
import { haptic } from '../../lib/haptics'
import { COLUMN_TYPES, TYPE_HINT, typeFit, type ColumnType } from '../../utils/columnTypes'
import { TypeIcon } from './icons'
import { Popover } from './Popover'

export function TypeMenu({ col, anchorRef, onClose }: {
  col: string
  anchorRef: RefObject<HTMLElement | null>
  onClose: (returnFocus: boolean) => void
}) {
  const { state, setColumnType } = useData()
  const id = useId()
  const profile = state.profiles[col]
  const current = state.columnTypes[col]
  if (!profile) return null

  function choose(type: ColumnType, ok: boolean) {
    if (!ok) { haptic('refuse'); return }
    setColumnType(col, type)
    onClose(true)
  }

  return (
    <Popover anchorRef={anchorRef} title={`Column type: ${col}`} onClose={onClose}>
      <p className="lab-popover-body data-type-intro">The app guesses the type from the values. Pick the one that fits.</p>
      <div className="data-typemenu">
        {COLUMN_TYPES.map((type) => {
          const fit = typeFit(profile, type)
          const reasonId = `${id}-${type}`
          return (
            <button
              key={type}
              type="button"
              className="data-typeopt"
              aria-pressed={type === current}
              aria-disabled={fit.ok ? undefined : true}
              aria-describedby={fit.ok ? undefined : reasonId}
              onClick={() => choose(type, fit.ok)}
            >
              <TypeIcon type={type} />
              <span>
                <strong>{type}</strong>
                <span className="data-typeopt-hint">{TYPE_HINT[type]}</span>
                {!fit.ok && <span id={reasonId} className="data-typeopt-reason">{fit.reason}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </Popover>
  )
}
