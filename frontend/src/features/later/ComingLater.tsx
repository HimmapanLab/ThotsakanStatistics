// STUB created by the Foundation stage so every branch compiles on its own. Owner: the Home builder, who replaces
// this file. The contract is the default export `ComingLater({ onBack })`: the "Coming later" page for Linear
// Regression, with a "Back to the topics" button that calls `onBack`.
export default function ComingLater({ onBack }: { onBack: () => void }) {
  return (
    <section className="lab-later" aria-labelledby="later-title">
      <h1 id="later-title">Linear Regression is coming later</h1>
      <p>This topic is not built yet. The other three are ready to use.</p>
      <button type="button" className="lab-btn" onClick={onBack}>Back to the topics</button>
    </section>
  )
}
