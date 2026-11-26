// Runs before every test file. Saved page state, the session record and the precision live in localStorage;
// clearing it keeps one test's saved inputs from leaking into the next.
import { beforeEach } from 'vitest'

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage in this environment */ }
})
