from pydantic import BaseModel, Field
from typing import Annotated, Dict, List, Optional

class EstimatorOptions(BaseModel):
    mean_estimators: List[str]
    deviation_estimators: List[str]

class EstimatorRequest(BaseModel):
    session_id: str
    column: str

class InferenceParams(BaseModel):
    session_id: str
    column: str
    alpha: float = Field(0.05, gt=0.0, lt=1.0)
    mean_estimator: str = "Sample Mean"
    median_estimator: str = "Sample Median"
    sigma_estimator: str = "Deviation (1 ddof)"
    trim_param: Optional[float] = Field(None, gt=0.0, lt=0.5)
    winsor_limits: Optional[str] = None
    weights_column: Optional[str] = None
    bootstrap_mean: bool = False
    bootstrap_median: bool = False
    bootstrap_deviation: bool = False
    bootstrap_pi: bool = False
    bootstrap_samples: int = 1000  # limits in services/inference.check_bootstrap_work (they depend on n)
    # Normal-theory rows. A bootstrap flag ADDS its own row next to these instead of replacing them,
    # so the methods can be compared. Defaults reproduce the previous behaviour.
    ci_mean_normal: bool = True
    ci_median_normal: bool = True
    ci_deviation_normal: bool = True
    pi_mean_normal: bool = True
    pi_median_normal: bool = True
    pi_iqr_normal: bool = True
    filters: Optional[Dict[str, List[str]]] = None

class ConfidenceRegionsParams(InferenceParams):
    # The estimators are fixed server-side (sample mean, std with ddof=1, normal theory), so the
    # estimator and bootstrap fields inherited above are ignored for regions.
    # The plot window is chosen server-side (core/estimation/inference/region_bounds.py).
    probs: List[Annotated[float, Field(gt=0.0, lt=1.0)]] = Field(min_length=1, max_length=50)
    add_ci_box: bool = True

class PointEstimates(BaseModel):
    mean: float
    median: float
    deviation: float

class HistogramData(BaseModel):
    binEdges: List[float]
    counts: List[int]

class IntervalsResponse(BaseModel):
    table: str # JSON string of DataFrame via to_json(orient="records"); rows carry a Method column
    n: int
    point_estimates: PointEstimates
    histogram: HistogramData

class ConfidenceRegionsResponse(BaseModel):
    z_matrix: List[List[float]]
    mu_grid: List[float]
    sigma_grid: List[float]
    mu_hat: float
    sigma_hat: float
    mu_ci: List[float]
    sigma_ci: List[float]
    probs: List[float]
    levels: List[float]
    table: Optional[str] = None # Optional tabular view when add_ci_box is True
