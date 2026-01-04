"""
Task service - Business logic for task management
Ported from frontend/modules/taskManager.js
Refactored to use MongoDB
"""
import time
import uuid
from typing import List, Optional, Dict, Any
from models.task import Task, TaskCreate, TaskUpdate, Subtask, SubtaskCreate, Session
from database import db

class TaskService:
    """Task management service"""
    
    def __init__(self):
        pass

    @property
    def collection(self):
        return db.get_collection("tasks")
    
    def _generate_uuid(self) -> str:
        """Generate UUID v4"""
        return str(uuid.uuid4())
    
    def _get_current_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)
    
    async def get_all_tasks(self) -> List[Task]:
        """Get all tasks"""
        cursor = self.collection.find({})
        tasks_data = await cursor.to_list(length=None)
        return [Task(**t) for t in tasks_data]
    
    async def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        task_data = await self.collection.find_one({"id": task_id})
        if task_data:
            return Task(**task_data)
        return None
    
    async def get_active_task(self) -> Optional[Task]:
        """Get currently active task"""
        task_data = await self.collection.find_one({
            "status": "started",
            "currentSessionStart": {"$ne": None}
        })
        if task_data:
            return Task(**task_data)
        return None
    
    async def get_tasks_by_status(self, status: str) -> List[Task]:
        """Get tasks by status"""
        cursor = self.collection.find({"status": status})
        tasks_data = await cursor.to_list(length=None)
        return [Task(**t) for t in tasks_data]
    
    async def create_task(self, task_data: TaskCreate) -> Task:
        """Create a new task"""
        task = Task(
            id=self._generate_uuid(),
            text=task_data.text,
            deadlineDate=task_data.deadlineDate,
            deadlineTime=task_data.deadlineTime,
            category=task_data.category,
            created=self._get_current_timestamp(),
            subtasks=[],
            estimatedDuration=None,
            expectancy=5.0,
            value=5.0,
            impulsivity=5.0,
            delay=5.0,
            status="pending",
            actualTimeSpent=0,
            sessions=[],
            currentSessionStart=None,
            done=False,
            lastNotified=None,
            retryCount=0,
            postponementCount=0,
            hoursDelayedBeforeStarting=0.0,
            firstStartTime=None,
            appBackgroundEvents=0,
            dismissedReminders=0,
            totalReminders=0,
            activityLog=[],
            interventionHistory=[],
            tmtHistory=[]
        )
        
        doc = task.model_dump()
        print(f"DEBUG: Attempting to insert task {task.id} into DB...")
        result = await self.collection.insert_one(doc)
        print(f"DEBUG: Insert acknowledged: {result.acknowledged}, Inserted ID: {result.inserted_id}")
        
        # Verify persistence immediately
        saved = await self.collection.find_one({"id": task.id})
        if saved:
            print(f"DEBUG: VERIFICATION SUCCESS: Task {task.id} found in DB.")
        else:
            print(f"DEBUG: VERIFICATION FAILED: Task {task.id} NOT found in DB after insert!")
            
        count = await self.collection.count_documents({})
        print(f"DEBUG: Total tasks in collection: {count}")
        
        return task
    
    async def update_task(self, task_id: str, updates: TaskUpdate) -> Optional[Task]:
        """Update a task"""
        update_data = updates.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_task_by_id(task_id)

        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return False
        
        # If task is active, pause it first (conceptually, though we are deleting)
        # Actually, if we delete, we just delete.
        
        result = await self.collection.delete_one({"id": task_id})
        return result.deleted_count > 0
    
    async def start_task(self, task_id: str) -> Optional[Task]:
        """Start a task (begin session)"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        # Pause any other active task first
        active_task = await self.get_active_task()
        if active_task and active_task.id != task_id:
            await self.pause_task(active_task.id)
        
        # Start new session
        now = self._get_current_timestamp()
        
        updates = {
            "status": "started",
            "currentSessionStart": now,
            "done": False
        }
        
        # Set first start time if not set
        if task.firstStartTime is None:
            updates["firstStartTime"] = now
            
        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {"$set": updates},
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def pause_task(self, task_id: str) -> Optional[Task]:
        """Pause a task (end current session)"""
        task = await self.get_task_by_id(task_id)
        if not task or task.status != "started" or not task.currentSessionStart:
            return None
        
        now = self._get_current_timestamp()
        session_duration = (now - task.currentSessionStart) // 1000 // 60  # minutes
        
        # Create session object
        session = Session(
            startTime=task.currentSessionStart,
            endTime=now,
            duration=int(session_duration)
        )
        
        updates = {
            "actualTimeSpent": task.actualTimeSpent + int(session_duration),
            "currentSessionStart": None,
            "status": "paused"
        }
        
        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {
                "$set": updates,
                "$push": {"sessions": session.model_dump()}
            },
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def complete_task(self, task_id: str) -> Optional[Task]:
        """Complete a task"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        # If task is active, pause it first
        if task.status == "started" and task.currentSessionStart:
            await self.pause_task(task_id)
        
        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {"$set": {"status": "completed", "done": True}},
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def abandon_task(self, task_id: str) -> Optional[Task]:
        """Mark a task as abandoned"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        # If task is active, pause it first
        if task.status == "started" and task.currentSessionStart:
            await self.pause_task(task_id)
        
        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {"$set": {"status": "abandoned"}},
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def add_subtask(self, task_id: str, subtask_data: SubtaskCreate) -> Optional[Task]:
        """Add a subtask to a task"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        subtask = Subtask(
            id=self._generate_uuid(),
            text=subtask_data.text,
            estimatedDuration=subtask_data.estimatedDuration,
            done=False,
            created=self._get_current_timestamp()
        )
        
        # Calculate new estimated duration
        current_duration = sum(st.estimatedDuration for st in task.subtasks)
        new_duration = current_duration + subtask.estimatedDuration
        
        result = await self.collection.find_one_and_update(
            {"id": task_id},
            {
                "$push": {"subtasks": subtask.model_dump()},
                "$set": {"estimatedDuration": new_duration}
            },
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def toggle_subtask(self, task_id: str, subtask_id: str) -> Optional[Task]:
        """Toggle subtask completion"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        # Logic to toggle specific subtask in array is complex with pure Mongo operators if we don't know index
        # Easier to fetch, modify, save for nested array manipulation or use arrayFilters
        
        # Using arrayFilters approach
        # Note: We need to know current state to flip it? Or just set it? Toggle implies flip.
        # Let's find the subtask status first.
        
        target_subtask = next((s for s in task.subtasks if s.id == subtask_id), None)
        if not target_subtask:
            return None
            
        new_status = not target_subtask.done
        
        result = await self.collection.find_one_and_update(
            {"id": task_id, "subtasks.id": subtask_id},
            {"$set": {"subtasks.$.done": new_status}},
            return_document=True
        )
        
        if result:
            return Task(**result)
        return None
    
    async def get_current_session_duration(self, task_id: str) -> int:
        """Calculate current session duration for active task"""
        task = await self.get_task_by_id(task_id)
        if not task or task.status != "started" or not task.currentSessionStart:
            return 0
        
        now = self._get_current_timestamp()
        return (now - task.currentSessionStart) // 1000 // 60  # minutes
    
    async def get_total_time_spent(self, task_id: str) -> int:
        """Get total time spent including current session"""
        task = await self.get_task_by_id(task_id)
        if not task:
            return 0
        
        total = task.actualTimeSpent
        
        # Add current session if active
        if task.status == "started" and task.currentSessionStart:
            total += await self.get_current_session_duration(task_id)
        
        return total


# Global task service instance
task_service = TaskService()