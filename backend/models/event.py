"""
Pydantic models for Event data
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any


class EventCreate(BaseModel):
    """Event creation model"""
    event_type: str
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[int] = None
    user_id: Optional[str] = None


class Event(BaseModel):
    """Event model"""
    id: str
    timestamp: int
    event_type: str
    data: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    """Event response model"""
    success: bool
    event: Optional[Event] = None
    message: Optional[str] = None
