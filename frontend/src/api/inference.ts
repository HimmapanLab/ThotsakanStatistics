import { postJson } from "./client";
const BASE_URL = "/api/inference";

export interface EstimatorRequest {
  session_id: string;
  column: string;
}

export interface EstimatorOptions {
  mean_estimators: string[];
  deviation_estimators: string[];
}

export interface InferenceParams {
  session_id: string;
  column: string;
  alpha: number;
  mean_estimator: string;
  median_estimator: string;
  sigma_estimator: string;
  trim_param?: number | null;
  winsor_limits?: string | null;
  weights_column?: string | null;
  bootstrap_mean: boolean;
  bootstrap_median: boolean;
  bootstrap_deviation: boolean;
  bootstrap_pi: boolean;
  bootstrap_samples: number;
  // Normal-theory rows. A bootstrap flag adds its own row next to these rather than replacing them.
  ci_mean_normal: boolean;
  ci_median_normal: boolean;
  ci_deviation_normal: boolean;
  pi_mean_normal: boolean;
  pi_median_normal: boolean;
  pi_iqr_normal: boolean;
  filters?: Record<string, string[]> | null;
}

export interface ConfidenceRegionsParams extends InferenceParams {
  probs: number[];
  add_ci_box: boolean;
}

export interface IntervalsResponse {
  table: string; // JSON string; each record also carries a `Method` field
  n: number;
  point_estimates: { mean: number; median: number; deviation: number };
  histogram: { binEdges: number[]; counts: number[] };
}

export interface ConfidenceRegionsResponse {
  z_matrix: number[][];
  mu_grid: number[];
  sigma_grid: number[];
  mu_hat: number;
  sigma_hat: number;
  mu_ci: number[];
  sigma_ci: number[];
  probs: number[];
  levels: number[];
  table?: string;
}

export const inferenceApi = {
  getEstimators: (req: EstimatorRequest, signal?: AbortSignal): Promise<EstimatorOptions> =>
    postJson<EstimatorOptions>(`${BASE_URL}/estimators`, req, { sessionId: req.session_id, signal }),

  computeCI: (params: InferenceParams, signal?: AbortSignal): Promise<IntervalsResponse> =>
    postJson<IntervalsResponse>(`${BASE_URL}/ci`, params, { sessionId: params.session_id, signal }),

  computePI: (params: InferenceParams, signal?: AbortSignal): Promise<IntervalsResponse> =>
    postJson<IntervalsResponse>(`${BASE_URL}/pi`, params, { sessionId: params.session_id, signal }),

  computeRegions: (params: ConfidenceRegionsParams, signal?: AbortSignal): Promise<ConfidenceRegionsResponse> =>
    postJson<ConfidenceRegionsResponse>(`${BASE_URL}/regions`, params, { sessionId: params.session_id, signal }),
};
