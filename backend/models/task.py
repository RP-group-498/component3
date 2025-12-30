"""
Pydantic models for Task data validation and serialization
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class SubtaskBase(BaseModel):
    """Base subtask model"""
    text: str
    estimatedDuration: int = 0  # in minutes


class SubtaskCreate(SubtaskBase):
    """Subtask creation model"""
    pass


class Subtask(SubtaskBase):
    """Subtask model with ID"""
    id: str
    done: bool = False
    created: int  # timestamp


class ActivityLog(BaseModel):
    """Activity log entry"""
    timestamp: int
    appName: str
    windowTitle: str
    category: str
    detail: str
    isWorking: bool


class Session(BaseModel):
    """Task session model"""
    startTime: int
    endTime: int
    duration: int  # in minutes


class TMTHistory(BaseModel):
    """TMT history entry"""
    timestamp: int
    expectancy: float
    value: float
    impulsiveness: float
    delay: float
    motivation: float


class InterventionHistory(BaseModel):
    """Intervention history entry"""
    timestamp: int
    type: str
    reason: str
    message: str


class TaskBase(BaseModel):
    """Base task model"""
    text: str
    deadlineDate: Optional[str] = None
    deadlineTime: Optional[str] = None
    category: str = "personal"


class TaskCreate(TaskBase):
    """Task creation model"""
    pass


class TaskUpdate(BaseModel):
    """Task update model - all fields optional"""
    text: Optional[str] = None
    deadlineDate: Optional[str] = None
    deadlineTime: Optional[str] = None
    category: Optional[str] = None
    status: Optional[Literal["pending", "started", "paused", "completed", "abandoned"]] = None
    done: Optional[bool] = None
    
    # TMT values update
    expectancy: Optional[float] = None
    value: Optional[float] = None
    impulsivity: Optional[float] = None
    delay: Optional[float] = None
    tmtHistory: Optional[List[TMTHistory]] = None


class Task(TaskBase):
    """Full task model"""
    id: str
    
    # Subtasks
    subtasks: List[Subtask] = []
    estimatedDuration: Optional[int] = None
    
    # TMT values
    expectancy: float = 5.0
    value: float = 5.0
    impulsivity: float = 5.0
    delay: float = 5.0
    
    # Status tracking
    status: Literal["pending", "started", "paused", "completed", "abandoned"] = "pending"
    actualTimeSpent: int = 0  # in minutes
    sessions: List[Session] = []
    currentSessionStart: Optional[int] = None
    done: bool = False
    created: int
    lastNotified: Optional[int] = None
    
    # Behavioral tracking
    retryCount: int = 0
    postponementCount: int = 0
    hoursDelayedBeforeStarting: float = 0.0
    firstStartTime: Optional[int] = None
    appBackgroundEvents: int = 0
    dismissedReminders: int = 0
    totalReminders: int = 0
    
    # Activity and history
    activityLog: List[ActivityLog] = []
    interventionHistory: List[InterventionHistory] = []
    tmtHistory: List[TMTHistory] = []
    
    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    """Task response model"""
    success: bool
    task: Optional[Task] = None
    message: Optional[str] = None


class TaskListResponse(BaseModel):
    """Task list response model"""
    success: bool
    tasks: List[Task]
    count: int
