"""
Event service - Event logging and tracking
Ported from frontend/modules/eventLogger.js
Refactored to use MongoDB
"""
import time
import uuid
from typing import List, Optional, Dict, Any
from models.event import Event, EventCreate
from database import db


class EventService:
    """Event logging service"""
    
    def __init__(self):
        pass

    @property
    def collection(self):
        return db.get_collection("events")
    
    def _generate_uuid(self) -> str:
        """Generate UUID v4"""
        return str(uuid.uuid4())
    
    def _get_current_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)
    
    async def log_event(self, event_data: EventCreate) -> Event:
        """Log a new event"""
        event_dict = {
            "id": self._generate_uuid(),
            "timestamp": event_data.timestamp if event_data.timestamp else self._get_current_timestamp(),
            "event_type": event_data.event_type,
            "data": event_data.data or {}
        }
        
        if event_data.user_id:
            event_dict["user_id"] = event_data.user_id
        
        # Create Event model instance
        event = Event(**event_dict)
        
        # Convert to dict for insertion
        doc = event.model_dump()
        
        await self.collection.insert_one(doc)
        
        return event
    
    async def get_events(self, limit: int = 100, event_type: Optional[str] = None) -> List[Event]:
        """Get events with optional filtering"""
        query = {}
        if event_type:
            query["event_type"] = event_type
        
        # Return most recent events first (sort by timestamp desc)
        cursor = self.collection.find(query).sort("timestamp", -1).limit(limit)
        events_data = await cursor.to_list(length=limit)
        
        return [Event(**e) for e in events_data]
    
    async def get_event_by_id(self, event_id: str) -> Optional[Event]:
        """Get event by ID"""
        event_data = await self.collection.find_one({"id": event_id})
        if event_data:
            return Event(**event_data)
        return None


# Global event service instance
event_service = EventService()