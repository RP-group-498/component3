"""
App Settings service - Business logic for app settings and timer state management
"""
import time
from typing import Optional
from models.app_settings import (
    AppSettings,
    AppSettingsUpdate,
    TimerState,
    TimerStateUpdate,
    ActiveSession
)
from database import db


class AppSettingsService:
    """App settings management service"""

    def __init__(self):
        pass

    @property
    def collection(self):
        return db.get_collection("app_settings")

    def _get_current_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)

    async def get_settings(self, user_id: str = "default") -> AppSettings:
        """
        Get app settings for a user
        Creates default settings if not found
        """
        settings_data = await self.collection.find_one({"userId": user_id})

        if not settings_data:
            # Create default settings
            default_settings = AppSettings(
                id="app_settings",
                userId=user_id,
                focusDuration=25,
                breakDuration=5,
                longBreakDuration=15,
                sessionsUntilLongBreak=4,
                timerState=None,
                activeSession=None,
                notificationsEnabled=True,
                soundEnabled=True,
                theme="auto",
                lastUpdated=self._get_current_timestamp()
            )

            await self.collection.insert_one(default_settings.model_dump())
            return default_settings

        return AppSettings(**settings_data)

    async def update_settings(
        self,
        updates: AppSettingsUpdate,
        user_id: str = "default"
    ) -> Optional[AppSettings]:
        """Update app settings"""
        update_data = updates.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_settings(user_id)

        # Add timestamp
        update_data["lastUpdated"] = self._get_current_timestamp()

        result = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": update_data},
            return_document=True,
            upsert=True
        )

        if result:
            return AppSettings(**result)
        return None

    async def get_timer_state(self, user_id: str = "default") -> Optional[TimerState]:
        """Get current timer state"""
        settings = await self.get_settings(user_id)
        return settings.timerState

    async def update_timer_state(
        self,
        timer_updates: TimerStateUpdate,
        user_id: str = "default"
    ) -> Optional[TimerState]:
        """Update timer state"""
        settings = await self.get_settings(user_id)

        # Get current timer state or create new one
        current_timer = settings.timerState or TimerState(
            lastUpdated=self._get_current_timestamp()
        )

        # Apply updates
        update_dict = timer_updates.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(current_timer, key, value)

        # Update timestamp
        current_timer.lastUpdated = self._get_current_timestamp()

        # Save to database
        result = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": {
                "timerState": current_timer.model_dump(),
                "lastUpdated": self._get_current_timestamp()
            }},
            return_document=True,
            upsert=True
        )

        if result:
            updated_settings = AppSettings(**result)
            return updated_settings.timerState
        return None

    async def clear_timer_state(self, user_id: str = "default") -> bool:
        """Clear/reset timer state"""
        result = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": {
                "timerState": None,
                "lastUpdated": self._get_current_timestamp()
            }},
            return_document=True
        )
        return result is not None

    async def get_active_session(self, user_id: str = "default") -> Optional[ActiveSession]:
        """Get active session recovery data"""
        settings = await self.get_settings(user_id)
        return settings.activeSession

    async def save_active_session(
        self,
        task_id: str,
        start_time: int,
        user_id: str = "default"
    ) -> Optional[ActiveSession]:
        """Save active session for crash recovery"""
        active_session = ActiveSession(
            taskId=task_id,
            startTime=start_time,
            lastSave=self._get_current_timestamp()
        )

        result = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": {
                "activeSession": active_session.model_dump(),
                "lastUpdated": self._get_current_timestamp()
            }},
            return_document=True,
            upsert=True
        )

        if result:
            return active_session
        return None

    async def clear_active_session(self, user_id: str = "default") -> bool:
        """Clear active session data"""
        result = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": {
                "activeSession": None,
                "lastUpdated": self._get_current_timestamp()
            }},
            return_document=True
        )
        return result is not None


# Global app settings service instance
app_settings_service = AppSettingsService()
