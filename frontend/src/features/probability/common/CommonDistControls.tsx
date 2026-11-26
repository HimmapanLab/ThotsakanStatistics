import { useMemo, useState, useEffect } from 'react'
import DualInput from '../../../components/DualInput'
import { AnalysisActions, RadioGroup, SelectField } from '../../../components/ControlPrimitives'
import { StepBox } from '../../../components/lab'
import { DISTRIBUTIONS, paramBounds } from '../../../hooks/useDistribution'
import { queryDomain } from '../../../math/localDistributions'
import { opSymbol, type BoundOp, type DistQuery, type QueryOp } from '../../../math/probabilityQuery'
import { defaultQuery, snapToStep, supportError } from '../../../math/queryDomain'
import QuerySlider from './QuerySlider'
import { DistFx, QueryFx } from './ProbFormula'
import { FxTop } from '../../hypothesis/ui/blocks'

interface CommonDistControlsProps {
  modelType: 'discrete' | 'continuous'
  distName: string
  paramValues: Record<string, number>
  query: DistQuery
  onModelTypeChange: (t: 'discrete' | 'continuous') => void
  onDistChange: (name: string) => void
  onParamChange: (key: string, value: number) => void
  onQueryChange: (query: DistQuery) => void
  onReset: () => void
}

const QUERY_OPS: readonly QueryOp[] = ['<=', '<', '=', '>=', '>']
const BOUND_OPS: readonly BoundOp[] = ['<', '<=']

/** The query row reads as a formula, x₁ < X ≤ x₂, so its fields are compact and labelled for screen readers. */
const compactField = `min-w-0 rounded-md border border-[var(--color-border-md)] bg-[var(--color-bg-input)] py-2 text-sm
  text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]`

function OpSelect<T extends QueryOp>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (op: T) => void
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}
      className={`${compactField} w-12 shrink-0 px-1 text-center`}>
      {options.map((op) => <option key={op} value={op}>{opSymbol(op)}</option>)}
    </select>
  )
}

function ValueInput({ label, value, invalid, onChange }: {
  label: string; value: string; invalid: boolean; onChange: (raw: string) => void
}) {
  return (
    <input type="text" inputMode="decimal" aria-label={label} aria-invalid={invalid} value={value}
      onChange={(event) => onChange(event.target.value)} className={`${compactField} w-full flex-1 px-2 font-mono`} />
  )
}

function parseNumber(raw: string): number {
  const trimmed = raw.trim()
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed) ? Number(trimmed) : Number.NaN
}

/** The text in each query field; kept apart from the query so an unfinished entry is not lost. */
function queryTexts(query: DistQuery) {
  return query.kind === 'one-sided'
    ? { k: String(query.k), lower: String(query.k), upper: String(query.k) }
    : { k: String(query.lower), lower: String(query.lower), upper: String(query.upper) }
}

/** Whether the text already shows this query, e.g. "1.0" while typing 1.05 shows k = 1. */
function textsShow(texts: { k: string; lower: string; upper: string }, query: DistQuery) {
  return query.kind === 'one-sided'
    ? parseNumber(texts.k) === query.k
    : parseNumber(texts.lower) === query.lower && parseNumber(texts.upper) === query.upper
}

const INCOMPLETE = 'Enter a complete number.'

export default function CommonDistControls({
  modelType,
  distName,
  paramValues,
  query,
  onModelTypeChange,
  onDistChange,
  onParamChange,
  onQueryChange,
  onReset,
}: CommonDistControlsProps) {
  const availableDists = useMemo(
    () => DISTRIBUTIONS.filter((d) => d.type === modelType),
    [modelType]
  )

  const currentDist = DISTRIBUTIONS.find((d) => d.name === distName)
  const domain = useMemo(() => queryDomain(distName, paramValues), [distName, paramValues])

  const [texts, setTexts] = useState(() => queryTexts(query))
  const [resetGeneration, setResetGeneration] = useState(0)

  // A query set from outside (slider, Reset, another distribution) replaces whatever is typed.
  useEffect(() => { setTexts((current) => textsShow(current, query) ? current : queryTexts(query)) }, [query])

  const k = parseNumber(texts.k)
  const lower = parseNumber(texts.lower)
  const upper = parseNumber(texts.upper)
  const valueError = (value: number) => Number.isFinite(value) ? supportError(value, domain) : INCOMPLETE
  const errors = query.kind === 'one-sided'
    ? { k: valueError(k) }
    : {
        lower: valueError(lower),
        upper: valueError(upper),
        order: Number.isFinite(lower) && Number.isFinite(upper) && lower > upper ? 'x₂ must not be less than x₁.' : undefined,
      }
  const messages = 'k' in errors
    ? [errors.k]
    : [errors.lower && `x₁: ${errors.lower}`, errors.upper && `x₂: ${errors.upper}`, errors.order]

  /** Applies typed text; the query (and the result) only changes once every field is valid. */
  const editText = (field: 'k' | 'lower' | 'upper', raw: string) => {
    const next = { ...texts, [field]: raw }
    setTexts(next)
    const value = { k: parseNumber(next.k), lower: parseNumber(next.lower), upper: parseNumber(next.upper) }
    const valid = (x: number) => !valueError(x)
    if (query.kind === 'one-sided') {
      if (valid(value.k)) onQueryChange({ ...query, k: value.k })
    } else if (valid(value.lower) && valid(value.upper) && value.lower <= value.upper) {
      onQueryChange({ ...query, lower: value.lower, upper: value.upper })
    }
  }

  /** Slider handles cannot cross: x₁ stops at x₂ and x₂ stops at x₁. */
  const slide = (index: number, raw: number) => {
    const value = snapToStep(raw, domain)
    if (query.kind === 'one-sided') onQueryChange({ ...query, k: value })
    else if (index === 0) onQueryChange({ ...query, lower: Math.min(value, query.upper) })
    else onQueryChange({ ...query, upper: Math.max(value, query.lower) })
  }

  const changeKind = (kind: DistQuery['kind']) => {
    if (kind === query.kind) return
    onQueryChange(defaultQuery(distName, paramValues, kind === 'one-sided'
      ? { kind, op: '<=', k: 0 }
      : { kind, lower: 0, lowerOp: '<', upper: 0, upperOp: '<=' }))
  }

  const fill: [number, number] | null = query.kind === 'interval' ? [query.lower, query.upper]
    : query.op === '<=' || query.op === '<' ? [domain.min, query.k]
    : query.op === '>=' || query.op === '>' ? [query.k, domain.max]
    : null

  return (
    <form className="hp-steps" onSubmit={(event) => event.preventDefault()}>
      <StepBox n={1} title="Distribution">
        <div className="hp-stack">
          <RadioGroup label="Model type" value={modelType} onChange={onModelTypeChange}
            options={[{ value: 'discrete', label: 'Discrete' }, { value: 'continuous', label: 'Continuous' }]} />
          <FxTop fx={<DistFx name={distName} part="dist" />}>
            <SelectField label="Distribution" value={distName} onChange={onDistChange}
              options={availableDists.map((dist) => ({ value: dist.name, label: `${dist.name} Distribution` }))} />
          </FxTop>
        </div>
      </StepBox>

      <StepBox n={2} title="Parameters">
        {currentDist && (
          <div className="hp-stack">
            {currentDist.params.map((param, index) => {
              const field = (
                <DualInput
                  key={param.key}
                  label={param.label}
                  value={paramValues[param.key] ?? param.default}
                  {...paramBounds(param, paramValues)}
                  step={param.step}
                  decimals={param.decimals}
                  resetSignal={resetGeneration}
                  onChange={(v) => onParamChange(param.key, param.integer ? Math.round(v) : v)}
                />
              )
              return index === 0
                ? <FxTop key={param.key} fx={<DistFx name={distName} part="params" />}>{field}</FxTop>
                : field
            })}
          </div>
        )}
      </StepBox>

      <StepBox n={3} title="Query">
        <div className="hp-stack">
          <FxTop fx={<QueryFx />}>
            <RadioGroup label="Probability to find" value={query.kind} onChange={changeKind}
              options={[{ value: 'one-sided', label: 'One-sided' }, { value: 'interval', label: 'Interval' }]} />
          </FxTop>
          {query.kind === 'one-sided' ? (
            <div className="hp-query-row">
              <span className="font-mono text-sm text-[var(--color-text)]">X</span>
              <OpSelect label="Inequality" value={query.op} options={QUERY_OPS} onChange={(op) => onQueryChange({ ...query, op })} />
              <ValueInput label="Value (x)" value={texts.k} invalid={!!errors.k} onChange={(raw) => editText('k', raw)} />
            </div>
          ) : (
            <div className="hp-query-row">
              <ValueInput label="Lower value (x₁)" value={texts.lower} invalid={!!(errors.lower || errors.order)}
                onChange={(raw) => editText('lower', raw)} />
              <OpSelect label="Lower inequality" value={query.lowerOp} options={BOUND_OPS}
                onChange={(op) => onQueryChange({ ...query, lowerOp: op })} />
              <span className="font-mono text-sm text-[var(--color-text)]">X</span>
              <OpSelect label="Upper inequality" value={query.upperOp} options={BOUND_OPS}
                onChange={(op) => onQueryChange({ ...query, upperOp: op })} />
              <ValueInput label="Upper value (x₂)" value={texts.upper} invalid={!!(errors.upper || errors.order)}
                onChange={(raw) => editText('upper', raw)} />
            </div>
          )}
          <div className="mt-2">
            <QuerySlider min={domain.min} max={domain.max} step={domain.step} fill={fill} onChange={slide}
              handles={query.kind === 'one-sided' ? [{ label: 'x', value: query.k }]
                : [{ label: 'x₁', value: query.lower }, { label: 'x₂', value: query.upper }]} />
          </div>
          {messages.filter(Boolean).map((message) => <p key={message} role="alert" className="hp-err">{message}</p>)}

          <AnalysisActions onReset={() => {
            setResetGeneration(value => value + 1)
            onReset()
          }} />
        </div>
      </StepBox>
    </form>
  )
}
