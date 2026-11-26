import { useId, type ReactNode } from 'react'

/**
 * A step that waits for the one before it: a faint header only, so people see how many steps are left.
 * It has no controls, so there is nothing to tab to; a screen reader hears what opens it (`after`: the step
 * that opens it, the one before by default; the pages whose steps 2 and 3 open together say 1).
 */
export function LockedStep({ n, title, after = n - 1 }: { n: number; title: ReactNode; after?: number }) {
  const id = useId()
  return (
    <section className="lab-step is-locked" aria-labelledby={id} aria-disabled="true">
      <div className="lab-step-head">
        <span className="lab-step-num" aria-hidden="true">{n}</span>
        <h2 className="lab-step-title" id={id}>
          {title}
          <span className="sr-only"> (opens after step {after})</span>
        </h2>
      </div>
    </section>
  )
}

export default LockedStep
