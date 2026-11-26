import { postJson } from './client'
export interface StatRow {
  category: 'Quantiles' | 'Central Tendency' | 'Dispersion' | 'Shape' | 'Extremes'
  measure: string
  value: number | null
  consistencyCorr: number | null
  robust?: boolean
  statId?: string
  warning?: string
}

export interface DescriptiveSummary {
  n: number
  mean: number
  median: number
  std: number
  iqr: number
}

export interface HistogramData {
  binEdges: number[]
  counts: number[]
}

export interface DescriptiveResult {
  rows: StatRow[]
  summary: DescriptiveSummary
  histogram: HistogramData
  boxData: {
    whiskerLo: number; q1: number; median: number; q3: number; whiskerHi: number
    outliers: number[]
  }
}

export interface DescriptiveInput {
  sessionId: string
  column: string
  quantileProbs: number[]
  trimAlpha: number | null
  winsorLimits: [number, number] | null
  weightsCol: string | null
  filters: Record<string, string[]> | null
}

export async function computeDescriptiveStats(input: DescriptiveInput, signal?: AbortSignal): Promise<DescriptiveResult> {
  return postJson<DescriptiveResult>('/api/descriptive/compute', {
    session_id: input.sessionId,
    column: input.column,
    quantileProbs: input.quantileProbs,
    trimAlpha: input.trimAlpha,
    winsorLimits: input.winsorLimits,
    weightsCol: input.weightsCol,
    filters: input.filters,
  }, { sessionId: input.sessionId, signal })
}
