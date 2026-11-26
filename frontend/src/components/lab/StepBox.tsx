import { useEffect, useId, useState, type ReactNode } from 'react'

/**
 * One numbered input step. Steps appear in order and never fold away once filled (step gating, decisions.md
 * 2026-11-26). `isNew` is for a step that has just appeared: it fades in, and a screen reader hears that it
 * opened. Results never animate; only steps do.
 */
export function StepBox({ n, title, isNew = false, children }: {
  n: number
  title: ReactNode
  isNew?: boolean
  children?: ReactNode
}) {
  const id = useId()
  return (
    <section className={`lab-step${isNew ? ' is-new' : ''}`} aria-labelledby={id}>
      <div className="lab-step-head">
        <span className="lab-step-num" aria-hidden="true">{n}</span>
        <h2 className="lab-step-title" id={id}>{title}</h2>
      </div>
      {isNew && <OpenedNotice n={n} />}
      {children}
    </section>
  )
}

/**
 * A polite live region that says "Step 2 opened". The region is empty when it mounts and gets its text a moment
 * later, because a screen reader announces a change inside a live region, not a region that arrives full.
 */
function OpenedNotice({ n }: { n: number }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setText(`Step ${n} opened`), 50)
    return () => window.clearTimeout(timer)
  }, [n])
  return <span className="sr-only" role="status" aria-live="polite">{text}</span>
}

export default StepBox
