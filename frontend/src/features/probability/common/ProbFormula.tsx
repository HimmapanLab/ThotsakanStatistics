import { FormulaButton } from '../../../components/lab'
import { DIST_FORMULAS } from './distributionFormulas'
import { QUERY_FORMULA_NOTE } from '../../hypothesis/ui/formulaNotes'

/** The parts of a distribution an ƒ button can explain. */
export type DistPart = 'dist' | 'params' | 'mean' | 'variance'

/** What backend/core has no formula for yet: said plainly, never invented. */
const NONE = 'The formula for this distribution will be added soon.'

/**
 * One ƒ button for one part of the chosen distribution, typeset from distributionFormulas.ts (the
 * parameterizations follow backend/core/probability/common_distributions). It shows only that part.
 */
export function DistFx({ name, part }: { name: string; part: DistPart }) {
  const formulas = DIST_FORMULAS[name]
  if (!formulas) return <FormulaButton title={name}>{NONE}</FormulaButton>
  switch (part) {
    case 'dist':
      return <FormulaButton title={`${name} distribution`} tex={[formulas.density, formulas.support]}>{formulas.description}</FormulaButton>
    case 'params':
      return (
        <FormulaButton title={`${name}: parameters`} tex={formulas.parameters.map((param) => param.tex)}>
          <p>{formulas.description}</p>
          <ul className="hp-meanings">
            {formulas.parameters.map((param) => <li key={param.tex}>{param.meaning}</li>)}
          </ul>
        </FormulaButton>
      )
    case 'mean':
      return <FormulaButton title={`${name}: mean`} tex={formulas.mean}>The long-run average of the variable.</FormulaButton>
    case 'variance':
      return <FormulaButton title={`${name}: variance`} tex={formulas.variance}>The average squared distance of the variable from its mean.</FormulaButton>
  }
}

/** The probability query has no entry in distributionFormulas.ts, so its ƒ says so. */
export function QueryFx() {
  return <FormulaButton title="probability query">{QUERY_FORMULA_NOTE}</FormulaButton>
}
