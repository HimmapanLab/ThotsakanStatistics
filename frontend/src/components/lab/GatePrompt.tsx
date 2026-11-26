/**
 * What the results area says before a variable is picked: a heading and one line on what to do. It is a
 * status, so a screen reader hears it when the page opens.
 */
export function GatePrompt({ text, title = 'Pick a variable to start' }: { text: string; title?: string }) {
  return (
    <div className="lab-prompt" role="status">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}

export default GatePrompt
