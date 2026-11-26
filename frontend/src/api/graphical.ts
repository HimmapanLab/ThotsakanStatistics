import { postJson } from "./client";
const BASE_URL = "/api/graphical";

export type GraphType = "Histogram" | "ECDF";

export interface GraphicalParams {
  column: string;
  graph_type: GraphType;

  // Histogram display; bins null = automatic (width 1 for whole numbers)
  bins?: number | null;
  add_kde: boolean;
  kde_bandwidth?: number | null; // null = Scott's rule

  // ECDF band: significance level alpha, as in every other tab
  add_conf_band?: boolean;
  alpha?: number;

  // Normal overlay and the estimators it is drawn from
  add_normal: boolean;
  mu_estimator?: string; // any mean estimator, or "Sample Median"
  sigma_estimator?: string;
  trim_param?: number | null;
  winsor_limits?: string | null;
  weights_column?: string | null;

  filters?: Record<string, string[]> | null;
}

export interface GraphicalResponse {
  summary: { n: number; n_unique: number };
  histogram_data?: { bins: number[]; counts: number[]; densities: number[]; unit_width?: boolean } | null;
  ecdf_data?: {
    x: number[];
    y: number[];
    epsilon: number;
    lower?: number[] | null;
    upper?: number[] | null;
  } | null;
  kde_curve?: { x: number[]; y: number[]; bandwidth: number; default_bandwidth: number } | null;
  normal_curve?: { x: number[]; y: number[]; mu: number; sigma: number } | null;
  point_estimates?: { mu: number | null; sigma: number | null } | null;
  alpha?: number | null; // set only when an ECDF band was drawn
  warnings: string[];
}

export const graphicalApi = {
  computeGraph: (sessionId: string, params: GraphicalParams, signal?: AbortSignal): Promise<GraphicalResponse> =>
    postJson<GraphicalResponse>(`${BASE_URL}/compute`, params, { sessionId, signal }),
};
