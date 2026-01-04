"""
History Service - Handles long-term storage of motivation data
"""
from typing import List, Optional
from models.history import MotivationLog, DailyStats
from models.task import Task
from database import db
import time

class HistoryService:
    """Service for managing historical data and stats"""

    @property
    def log_collection(self):
        return db.get_collection("motivation_logs")

    @property
    def stats_collection(self):
        return db.get_collection("daily_stats")

    def _get_current_timestamp(self) -> int:
        return int(time.time() * 1000)

    async def log_snapshot(self, task: Task) -> bool:
        """
        Takes a snapshot of the current task's motivation state 
        and saves it to the motivation_logs collection.
        """
        try:
            log_entry = MotivationLog(
                taskId=task.id,
                taskTitle=task.text,
                timestamp=self._get_current_timestamp(),
                expectancy=task.expectancy,
                value=task.value,
                impulsiveness=task.impulsivity, # Note: Task model uses 'impulsivity'
                delay=task.delay,
                motivation=(task.expectancy * task.value) / (1 + task.impulsivity * task.delay), # Recalc or pass if available
                category=task.category,
                status=task.status
            )
            
            await self.log_collection.insert_one(log_entry.model_dump())
            return True
        except Exception as e:
            print(f"Error logging history snapshot: {e}")
            return False

    async def get_logs_for_task(self, task_id: str) -> List[MotivationLog]:
        """Retrieve all historical logs for a specific task"""
        cursor = self.log_collection.find({"taskId": task_id}).sort("timestamp", 1)
        logs = await cursor.to_list(length=None)
        return [MotivationLog(**log) for log in logs]

    async def get_logs_by_date_range(self, start_ts: int, end_ts: int) -> List[MotivationLog]:
        """Retrieve logs within a specific time range (e.g., for a Month View)"""
        cursor = self.log_collection.find({
            "timestamp": {"$gte": start_ts, "$lte": end_ts}
        }).sort("timestamp", 1)
        logs = await cursor.to_list(length=None)
        return [MotivationLog(**log) for log in logs]

# Global instance
history_service = HistoryService()
