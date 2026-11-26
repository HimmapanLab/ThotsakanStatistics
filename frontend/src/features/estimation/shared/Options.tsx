import { useId, type ReactNode } from 'react'
import './estimation.css'

/** A fieldset with a small uppercase legend: "Plot type", "Overlays", "Basic". */
export function OptionGroup({ legend, srOnlyLegend = false, children }: { legend: ReactNode; srOnlyLegend?: boolean; children: ReactNode }) {
  return (
    <fieldset className="est-group">
      <legend className={srOnlyLegend ? 'sr-only' : undefined}>{legend}</legend>
      {children}
    </fieldset>
  )
}

export function SubHead({ children }: { children: ReactNode }) {
  return <div className="est-subhead">{children}</div>
}

/**
 * One choice: a checkbox or a radio with its label, and the ƒ button for its formula at the right. `detail` is
 * an extra control that applies only while the option is ticked. An option that does not fit right now is
 * `gated`: greyed out, with the reason under it (never a silent disable).
 */
export function Option({ kind = 'checkbox', name, checked, onChange, label, fx, detail, gated, why, onGatedTouch }: {
  kind?: 'checkbox' | 'radio'
  name?: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  fx?: ReactNode
  detail?: ReactNode
  gated?: boolean
  why?: string
  onGatedTouch?: () => void
}) {
  const whyId = useId()
  if (gated) {
    return (
      <div className="est-gated" onPointerDown={(event) => { if (event.pointerType === 'touch') onGatedTouch?.() }}>
        <label className="est-check">
          <input type={kind} name={name} checked={false} disabled aria-describedby={why ? whyId : undefined} readOnly />
          <span>{label}</span>
        </label>
        {why && <p className="est-why" id={whyId}>{why}</p>}
      </div>
    )
  }
  return (
    <div>
      <div className="est-opt">
        <label className="est-check">
          <input type={kind} name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} />
          <span>{label}</span>
        </label>
        {fx}
      </div>
      {checked && detail && <div className="est-detail">{detail}</div>}
    </div>
  )
}
