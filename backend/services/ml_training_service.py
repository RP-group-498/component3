"""
ML Training Service - Logs behavioral snapshots for ML model training
"""
import time
import uuid
from typing import List, Optional
from models.ml_training import MLTrainingData, MLTrainingDataCreate
from models.task import Task
from database import db


class MLTrainingService:
    """Service for logging ML training data"""

    def __init__(self):
        pass

    @property
    def collection(self):
        return db.get_collection("ml_training_data")

    def _generate_uuid(self) -> str:
        """Generate UUID v4"""
        return str(uuid.uuid4())

    def _get_current_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)

    def _calculate_time_since_last_break(self, task: Task) -> int:
        """
        Calculate minutes since last session ended
        Returns 0 if no previous sessions or task is currently active
        """
        if not task.sessions:
            return 0

        # Find most recent session
        last_session = max(task.sessions, key=lambda s: s.endTime)
        current_time = self._get_current_timestamp()

        # Calculate minutes since last session ended
        minutes_since = (current_time - last_session.endTime) // 1000 // 60

        return int(minutes_since)

    def _get_session_start_motivation(self, task: Task) -> float:
        """
        Get motivation at session start
        Strategy: Check tmtHistory for entries near currentSessionStart
        Fallback to current motivation if not found
        """
        if not task.currentSessionStart or not task.tmtHistory:
            # Fallback: calculate from current TMT values
            # Motivation = (Expectancy × Value) / (1 + Impulsiveness × Delay)
            denominator = max(0.1, 1 + task.impulsivity * task.delay)
            return (task.expectancy * task.value) / denominator

        # Find TMT history entry closest to session start
        closest_entry = min(
            task.tmtHistory,
            key=lambda h: abs(h.timestamp - task.currentSessionStart)
        )

        return closest_entry.motivation

    def _calculate_current_motivation(self, task: Task) -> float:
        """
        Calculate current motivation from TMT values
        Motivation = (Expectancy × Value) / (1 + Impulsiveness × Delay)
        """
        denominator = max(0.1, 1 + task.impulsivity * task.delay)
        return (task.expectancy * task.value) / denominator

    def _calculate_motivation_delta(
        self, current_motivation: float, session_start_motivation: float
    ) -> float:
        """Calculate motivation change from session start"""
        return current_motivation - session_start_motivation

    async def log_session_event(
        self,
        task: Task,
        event_type: str,
        session_duration_minutes: int = 0
    ) -> MLTrainingData:
        """
        Log a session event (start, pause, complete)
        Calculates all necessary metrics and creates training record
        """
        # Calculate current motivation
        current_motivation = self._calculate_current_motivation(task)

        # Get session start motivation for delta calculation
        session_start_motivation = self._get_session_start_motivation(task)

        # Calculate motivation delta
        motivation_delta = self._calculate_motivation_delta(
            current_motivation, session_start_motivation
        )

        # Calculate time since last break
        time_since_last_break = self._calculate_time_since_last_break(task)

        # Create ML training data record
        training_data = MLTrainingDataCreate(
            task_id=task.id,
            event_type=event_type,
            motivation=current_motivation,
            expectancy=task.expectancy,
            value=task.value,
            impulsiveness=task.impulsivity,
            delay=task.delay,
            session_duration_minutes=session_duration_minutes,
            time_since_last_break_minutes=time_since_last_break,
            intervention_type=None,
            intervention_accepted=None,
            motivation_delta=motivation_delta,
            session_start_motivation=session_start_motivation,
            actual_time_spent=task.actualTimeSpent,
            task_status=task.status,
            task_category=task.category
        )

        # Add ID and timestamp
        ml_data = MLTrainingData(
            id=self._generate_uuid(),
            timestamp=self._get_current_timestamp(),
            **training_data.model_dump()
        )

        # Insert into database
        await self.collection.insert_one(ml_data.model_dump())

        return ml_data

    async def log_intervention_event(
        self,
        task: Task,
        intervention_type: str,
        intervention_accepted: bool,
        session_duration_minutes: int
    ) -> MLTrainingData:
        """
        Log when an intervention is displayed and user's response
        """
        # Calculate current motivation
        current_motivation = self._calculate_current_motivation(task)

        # Get session start motivation for delta calculation
        session_start_motivation = self._get_session_start_motivation(task)

        # Calculate motivation delta
        motivation_delta = self._calculate_motivation_delta(
            current_motivation, session_start_motivation
        )

        # Calculate time since last break
        time_since_last_break = self._calculate_time_since_last_break(task)

        # Create ML training data record
        training_data = MLTrainingDataCreate(
            task_id=task.id,
            event_type="intervention_displayed",
            motivation=current_motivation,
            expectancy=task.expectancy,
            value=task.value,
            impulsiveness=task.impulsivity,
            delay=task.delay,
            session_duration_minutes=session_duration_minutes,
            time_since_last_break_minutes=time_since_last_break,
            intervention_type=intervention_type,
            intervention_accepted=intervention_accepted,
            motivation_delta=motivation_delta,
            session_start_motivation=session_start_motivation,
            actual_time_spent=task.actualTimeSpent,
            task_status=task.status,
            task_category=task.category
        )

        # Add ID and timestamp
        ml_data = MLTrainingData(
            id=self._generate_uuid(),
            timestamp=self._get_current_timestamp(),
            **training_data.model_dump()
        )

        # Insert into database
        await self.collection.insert_one(ml_data.model_dump())

        return ml_data

    async def get_training_data(
        self,
        task_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[MLTrainingData]:
        """Query training data with filters"""
        query = {}

        if task_id:
            query["task_id"] = task_id

        if event_type:
            query["event_type"] = event_type

        cursor = self.collection.find(query).sort("timestamp", -1).limit(limit)
        data = await cursor.to_list(length=limit)

        return [MLTrainingData(**record) for record in data]

    async def get_training_data_stats(self) -> dict:
        """Get statistics about training data"""
        total_count = await self.collection.count_documents({})

        # Count by event type
        pipeline = [
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}
        ]
        event_type_counts = await self.collection.aggregate(pipeline).to_list(length=None)

        # Count interventions by acceptance
        intervention_pipeline = [
            {"$match": {"event_type": "intervention_displayed"}},
            {"$group": {
                "_id": "$intervention_accepted",
                "count": {"$sum": 1}
            }}
        ]
        intervention_stats = await self.collection.aggregate(intervention_pipeline).to_list(length=None)

        return {
            "total_records": total_count,
            "by_event_type": {item["_id"]: item["count"] for item in event_type_counts},
            "intervention_acceptance": {
                str(item["_id"]): item["count"] for item in intervention_stats
            }
        }


# Global ML training service instance
ml_training_service = MLTrainingService()
