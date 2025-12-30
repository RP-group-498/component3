"""
Pydantic models for TMT (Temporal Motivation Theory) calculations
"""
from pydantic import BaseModel
from typing import Optional


class TMTMetrics(BaseModel):
    """TMT metrics model"""
    expectancy: float
    value: float
    impulsiveness: float
    delay: float
    motivation: float


class TMTRawMetrics(BaseModel):
    """Raw TMT calculation metrics"""
    expectancy: float
    value: float
    impulsiveness: float
    delay: float
    
    # Raw component values
    successRate: float
    taskComplexity: float
    taskValue: float
    personalRelevance: float
    baseImpulsiveness: float
    distractionLevel: float
    timeToDeadline: float
    taskDuration: float


class TMTResponse(BaseModel):
    """TMT calculation response"""
    success: bool
    metrics: Optional[TMTMetrics] = None
    raw: Optional[TMTRawMetrics] = None
    message: Optional[str] = None
