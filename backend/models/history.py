"""
Pydantic models for Historical Statistics and Long-term Archival
"""
from pydantic import BaseModel, Field
from typing import Optional

class MotivationLog(BaseModel):
    """
    Single point-in-time motivation snapshot.
    Designed for high-frequency logging without bloating Task documents.
    """
    taskId: str
    taskTitle: str
    timestamp: int
    
    # TMT Metrics
    expectancy: float
    value: float
    impulsiveness: float
    delay: float
    motivation: float
    
    # Context (Snapshot)
    category: str
    status: str

class DailyStats(BaseModel):
    """
    Aggregated daily statistics for the "Yearly Review" view.
    """
    date: str # YYYY-MM-DD
    totalTasksCompleted: int
    totalWorkMinutes: int
    averageMotivation: float
    peakMotivation: float
    lowMotivation: float
