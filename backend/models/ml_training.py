"""
Pydantic models for ML Training Data
Logs behavioral snapshots for ML model training
"""
from pydantic import BaseModel
from typing import Optional, List, Literal


class MLTrainingDataCreate(BaseModel):
    """Model for creating ML training records"""
    task_id: str
    event_type: Literal["session_start", "session_pause", "session_complete", "intervention_displayed"]

    # TMT Metrics snapshot
    motivation: float
    expectancy: float
    value: float
    impulsiveness: float
    delay: float

    # Session context
    session_duration_minutes: int
    time_since_last_break_minutes: int

    # Intervention data (null for session events)
    intervention_type: Optional[str] = None
    intervention_accepted: Optional[bool] = None

    # Behavioral metrics
    motivation_delta: float
    session_start_motivation: float

    # Additional context
    actual_time_spent: int
    task_status: str
    task_category: str


class MLTrainingData(BaseModel):
    """Full ML training data model with ID and timestamp"""
    id: str
    timestamp: int  # milliseconds since epoch
    task_id: str
    event_type: str

    # TMT Metrics snapshot
    motivation: float
    expectancy: float
    value: float
    impulsiveness: float
    delay: float

    # Session context
    session_duration_minutes: int
    time_since_last_break_minutes: int

    # Intervention data
    intervention_type: Optional[str] = None
    intervention_accepted: Optional[bool] = None

    # Behavioral metrics
    motivation_delta: float
    session_start_motivation: float

    # Additional context
    actual_time_spent: int
    task_status: str
    task_category: str

    class Config:
        from_attributes = True


class MLTrainingDataResponse(BaseModel):
    """API response model for single ML training record"""
    success: bool
    data: Optional[MLTrainingData] = None
    message: Optional[str] = None


class MLTrainingDataListResponse(BaseModel):
    """API response model for list of ML training records"""
    success: bool
    data: List[MLTrainingData]
    count: int
    message: Optional[str] = None
