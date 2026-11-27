import { useRef } from 'react'

/**
 * The last valid number of a text field. While the typed text is not valid (`valid` is null) a slider
 * beside it keeps this value instead of jumping to a default, so a rejected entry returns to what the
 * reader had, not to 0.05.
 */
export function useLastValid(valid: number | null, initial: number): number {
  const last = useRef(initial)
  if (valid !== null) last.current = valid
  return last.current
}
