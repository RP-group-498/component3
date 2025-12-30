"""
Pydantic models for Event data
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any


class EventCreate(BaseModel):
    """Event creation model"""
    event_type: str
    data: Optional[Dict[str, Any]] = None


class Event(BaseModel):
    """Event model"""
    id: str
    timestamp: int
    event_type: str
    data: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    """Event response model"""
    success: bool
    event: Optional[Event] = None
    message: Optional[str] = None
