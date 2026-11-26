import type { DistParams } from '../../../hooks/useDistribution'

/**
 * The formulas moved into the ƒ popovers (ProbFormula.tsx), so there is no right panel any more. This empty
 * component stays only until App.tsx stops importing it; the integrator deletes both together.
 */
export default function CommonDistNotebook(_props: { distParams: DistParams }) {
  return null
}
