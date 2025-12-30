"""
Event logging API router
"""
from fastapi import APIRouter, HTTPException, status
from typing import Optional
from models.event import Event, EventCreate, EventResponse
from services.event_service import event_service

router = APIRouter()


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def log_event(event_data: EventCreate):
    """Log a new event"""
    event = await event_service.log_event(event_data)
    return EventResponse(
        success=True,
        event=event,
        message="Event logged successfully"
    )


@router.get("/")
async def get_events(limit: int = 100, event_type: Optional[str] = None):
    """Get events with optional filtering"""
    events = await event_service.get_events(limit=limit, event_type=event_type)
    return {
        "success": True,
        "events": events,
        "count": len(events)
    }


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: str):
    """Get event by ID"""
    event = await event_service.get_event_by_id(event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    return EventResponse(success=True, event=event)
