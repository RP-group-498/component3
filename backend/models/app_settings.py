"""
Pydantic models for App Settings and Timer State
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class TimerState(BaseModel):
    """Timer state model"""
    isActive: bool = False
    isPaused: bool = False
    isBreak: bool = False
    taskId: Optional[str] = None
    duration: int = 25  # in minutes
    remainingTime: int = 1500  # in seconds
    startTime: Optional[int] = None  # timestamp
    sessionsCompleted: int = 0
    lastUpdated: int  # timestamp


class TimerStateUpdate(BaseModel):
    """Timer state update model - all fields optional"""
    isActive: Optional[bool] = None
    isPaused: Optional[bool] = None
    isBreak: Optional[bool] = None
    taskId: Optional[str] = None
    duration: Optional[int] = None
    remainingTime: Optional[int] = None
    startTime: Optional[int] = None
    sessionsCompleted: Optional[int] = None


class ActiveSession(BaseModel):
    """Active session recovery data"""
    taskId: str
    startTime: int
    lastSave: int


class AppSettings(BaseModel):
    """Application settings model"""
    id: str = "app_settings"  # Single document ID
    userId: str = "default"  # Support for multi-user in future

    # Timer/Focus settings
    focusDuration: int = 25  # minutes
    breakDuration: int = 5  # minutes
    longBreakDuration: int = 15  # minutes
    sessionsUntilLongBreak: int = 4

    # Timer state (for persistence)
    timerState: Optional[TimerState] = None

    # Active session recovery
    activeSession: Optional[ActiveSession] = None

    # Other app settings can be added here
    notificationsEnabled: bool = True
    soundEnabled: bool = True
    theme: Literal["light", "dark", "auto"] = "auto"

    lastUpdated: int  # timestamp

    class Config:
        from_attributes = True


class AppSettingsUpdate(BaseModel):
    """App settings update model - all fields optional"""
    focusDuration: Optional[int] = None
    breakDuration: Optional[int] = None
    longBreakDuration: Optional[int] = None
    sessionsUntilLongBreak: Optional[int] = None
    timerState: Optional[TimerState] = None
    activeSession: Optional[ActiveSession] = None
    notificationsEnabled: Optional[bool] = None
    soundEnabled: Optional[bool] = None
    theme: Optional[Literal["light", "dark", "auto"]] = None


class AppSettingsResponse(BaseModel):
    """App settings response model"""
    success: bool
    settings: Optional[AppSettings] = None
    message: Optional[str] = None


class TimerStateResponse(BaseModel):
    """Timer state response model"""
    success: bool
    timerState: Optional[TimerState] = None
    message: Optional[str] = None
