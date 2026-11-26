import { useId, type ReactNode } from 'react'

/**
 * A step that waits for the one before it: a faint header only, so people see how many steps are left.
 * It has no controls, so there is nothing to tab to; a screen reader hears what opens it.
 */
export function LockedStep({ n, title }: { n: number; title: ReactNode }) {
  const id = useId()
  return (
    <section className="lab-step is-locked" aria-labelledby={id} aria-disabled="true">
      <div className="lab-step-head">
        <span className="lab-step-num" aria-hidden="true">{n}</span>
        <h2 className="lab-step-title" id={id}>
          {title}
          <span className="sr-only"> (opens after step {n - 1})</span>
        </h2>
      </div>
    </section>
  )
}

export default LockedStep
