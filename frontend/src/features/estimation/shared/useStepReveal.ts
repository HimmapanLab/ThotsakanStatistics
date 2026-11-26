import { useRef } from 'react'

/**
 * True while the steps after "Data" have just opened: the variable was empty when this page mounted and has been
 * picked since. Only those steps animate (and announce themselves); a page that mounts with a variable already
 * picked, or comes back from the Data drawer, shows its steps at once. The ref lives in the page's controls,
 * which unmount while the drawer is open, so a reopened page never replays the reveal.
 */
export function useStepReveal(picked: boolean): boolean {
  const waited = useRef(!picked)
  const revealed = useRef(false)
  if (picked && waited.current) revealed.current = true
  if (!picked) { waited.current = true; revealed.current = false }
  return revealed.current
}
