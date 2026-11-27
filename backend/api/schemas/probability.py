from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Union


class DistributionRequest(BaseModel):
    distName: str
    params: dict[str, float]
    queryOp: str  # '<=', '<', '>=', '>', '=' or 'between'
    queryK: float  # the value, or the lower end of a 'between' interval
    # 'between' only: P(queryK lowerOp X upperOp queryUpper), each op '<' or '<='
    queryUpper: Optional[float] = None
    lowerOp: Optional[str] = None
    upperOp: Optional[str] = None


class DistributionResponse(BaseModel):
    # discrete fields
    ks: Optional[list[int]] = None
    probs: Optional[list[float]] = None
    cumProbs: Optional[list[float]] = None
    # continuous fields
    xs: Optional[list[float]] = None
    ys: Optional[list[float]] = None
    cdfYs: Optional[list[float]] = None
    # shared
    queryResult: float
    theorMean: Union[float, str]
    theorVariance: Union[float, str]


class NormalPDFRequest(BaseModel):
    mean: float
    std: float = Field(gt=0.0)
    n: int = Field(ge=1)
    alpha: float = Field(gt=0.0, lt=1.0)


class NormalPDFResponse(BaseModel):
    xValues: list[float]
    yValues: list[float]
    cdfValues: list[float]
    ciLow: float
    ciHigh: float
    shadeX: list[float]
    shadeY: list[float]
    se: float
    zCritical: float
