// features/later/ComingLater.tsx
// The page of a topic that is not built yet (Linear Regression): the Figma illustration "Coming later" over centred
// text, then "Back to the topics". REBUILD-HANDOFF row 11; Figma "16 Regression later". The wording is the
// approved prototype's (regressionHtml).
import { ROUTE_NAMES } from '../../content/topics'
import { REG_BLOB, REG_DASHES, REG_DOTS } from '../home/sceneGeometry'
import '../home/scene.css'
import './later.css'

/** Illustration/Coming later (Feedback page): a chart sheet with a pale ghost trend and a clock. 288 x 216. */
export function ComingLaterIllustration() {
  return (
    <svg className="ill-later" viewBox="0 0 288 216" width="288" height="216" aria-hidden="true" focusable="false">
      <path className="sc-blob" d={REG_BLOB} />
      <rect className="sc-side" x="51" y="39" width="186" height="135" rx="15" />
      <rect className="sc-body" x="42" y="39" width="186" height="135" rx="15" />
      <rect className="sc-side" x="63" y="57" width="4.5" height="96" rx="2.25" />
      <rect className="sc-side" x="63" y="148.5" width="147" height="4.5" rx="2.25" />
      {REG_DASHES.map((d, i) => (
        <rect key={i} className="sc-blob" x={d[0]} y={d[1]} width="15" height="5.25" rx="2.625" transform={`rotate(-28.81 ${d[0]} ${d[1]})`} />
      ))}
      {REG_DOTS.map((d, i) => (
        <circle key={i} className="sc-side" cx={d[0]} cy={d[1]} r="5.25" />
      ))}
      <circle className="sc-ink" cx="52.5" cy="43.5" r="28.5" />
      <rect className="sc-paper" x="51.75" y="27" width="4.5" height="18" rx="2.25" />
      <rect className="sc-paper" x="51.75" y="41.25" width="15" height="4.5" rx="2.25" />
    </svg>
  )
}

export default function ComingLater({ onBack }: { onBack: () => void }) {
  return (
    <div className="later-scroll">
      <section className="later-page" aria-labelledby="later-title">
        <ComingLaterIllustration />
        <h1 id="later-title" className="later-title" tabIndex={-1}>{ROUTE_NAMES.regression}</h1>
        <p>Linear Regression is the next topic after the Hypothesis Testing rework. It will need two Continuous columns.</p>
        <button type="button" className="later-btn" onClick={onBack}>Back to the topics</button>
      </section>
    </div>
  )
}
