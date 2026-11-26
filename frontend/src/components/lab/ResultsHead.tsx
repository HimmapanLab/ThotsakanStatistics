import type { ReactNode } from 'react'

/**
 * The heading of the results. The page head already names the topic, so a title written "Topic · Part" keeps
 * only "Part". `sub` is a quiet line under it; `children` sit at the right (export, a chip).
 */
export function ResultsHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  const at = title.indexOf(' · ')
  const shown = at > 0 ? title.slice(at + 3) : title
  return (
    <div className="lab-output-head">
      <div>
        <h2 className="lab-output-title">{shown}</h2>
        {sub != null && <p className="lab-output-sub">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export default ResultsHead
