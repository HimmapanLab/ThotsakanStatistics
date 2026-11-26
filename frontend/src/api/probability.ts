import { postJson } from './client'
export interface DistributionRequest {
  distName: string
  params: Record<string, number>
  /** '<=', '<', '>=', '>', '=' or 'between'. */
  queryOp: string
  /** The value, or the lower end of a 'between' interval. */
  queryK: number
  /** 'between' only: P(queryK lowerOp X upperOp queryUpper). */
  queryUpper?: number
  lowerOp?: '<' | '<='
  upperOp?: '<' | '<='
}

export interface NormalPDFRequest {
  mean: number
  std: number
  n: number
  alpha: number
}

export interface NormalPDFResponse {
  xValues: number[]
  yValues: number[]
  cdfValues: number[]
  ciLow: number
  ciHigh: number
  shadeX: number[]
  shadeY: number[]
  se: number
  zCritical: number
}

export async function computeNormalPDF(
  req: NormalPDFRequest,
  signal?: AbortSignal,
): Promise<NormalPDFResponse> {
  return postJson<NormalPDFResponse>('/api/probability/normal-pdf', req, { signal })
}

export interface DistributionResponse {
  // discrete
  ks?: number[]
  probs?: number[]
  cumProbs?: number[]
  // continuous
  xs?: number[]
  ys?: number[]
  cdfYs?: number[]
  // shared
  queryResult: number
  theorMean: number | string
  theorVariance: number | string
}

export async function computeDistribution(
  req: DistributionRequest,
  signal?: AbortSignal,
): Promise<DistributionResponse> {
  return postJson<DistributionResponse>('/api/probability/compute', req, { signal })
}
