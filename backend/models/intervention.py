from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from .tmt import TMTMetrics

class InterventionType(str, Enum):
    """Available intervention types"""
    POMODORO = "pomodoro"
    TWO_MINUTE_RULE = "two_minute_rule"
    BREATHING = "breathing"
    REFRAMING = "reframing"
    BREAK = "break"
    NOTIFICATION = "notification"

class InterventionContext(BaseModel):
    """
    The context state used to decide the intervention.
    This captures the state of the user *before* the intervention.
    """
    task_id: str
    tmt_scores: TMTMetrics
    time_of_day_hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    session_duration_minutes: float
    time_since_last_break_minutes: float
    recent_procrastination_count: int

class InterventionProposal(BaseModel):
    """The suggested intervention returned to the frontend"""
    id: str  # Unique ID for this specific intervention instance
    type: InterventionType
    message: str
    predicted_efficacy: Optional[float] = None # Predicted improvement in motivation

class InterventionOutcome(BaseModel):
    """
    The result of an intervention.
    """
    intervention_id: str
    accepted: bool # Did the user accept/engage with the nudge?
    motivation_after_5min: float # The TMT motivation score 5 mins later
    user_feedback_rating: Optional[int] = None # 1-5 stars (optional)
    timestamp: datetime = Field(default_factory=datetime.now)

class TrainingDataPoint(BaseModel):
    """
    A flattened record combining Context + Action + Reward
    Used for ML training.
    """
    # Context
    expectancy: float
    value: float
    impulsiveness: float
    delay: float
    time_of_day: int
    session_duration: float
    
    # Action
    intervention_type: str
    
    # Reward
    motivation_delta: float # (After - Before)
    accepted: bool
