"""
Task management API router
"""
import time
from fastapi import APIRouter, HTTPException, status
from typing import List
from models.task import (
    Task,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    SubtaskCreate,
    InterventionLogRequest,
    InterventionHistory
)
from services.task_service import task_service

router = APIRouter()


@router.get("/", response_model=TaskListResponse)
async def get_all_tasks():
    """Get all tasks"""
    tasks = await task_service.get_all_tasks()
    return TaskListResponse(
        success=True,
        tasks=tasks,
        count=len(tasks)
    )


@router.get("/status/{status}", response_model=TaskListResponse)
async def get_tasks_by_status(status: str):
    """Get tasks by status"""
    tasks = await task_service.get_tasks_by_status(status)
    return TaskListResponse(
        success=True,
        tasks=tasks,
        count=len(tasks)
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get task by ID"""
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(success=True, task=task)


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task_data: TaskCreate):
    """Create a new task"""
    task = await task_service.create_task(task_data)
    return TaskResponse(
        success=True,
        task=task,
        message="Task created successfully"
    )


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, updates: TaskUpdate):
    """Update a task"""
    task = await task_service.update_task(task_id, updates)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Task updated successfully"
    )


@router.delete("/{task_id}", response_model=TaskResponse)
async def delete_task(task_id: str):
    """Delete a task"""
    success = await task_service.delete_task(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        message="Task deleted successfully"
    )


@router.post("/{task_id}/start", response_model=TaskResponse)
async def start_task(task_id: str):
    """Start a task (begin session)"""
    task = await task_service.start_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Task started successfully"
    )


@router.post("/{task_id}/pause", response_model=TaskResponse)
async def pause_task(task_id: str):
    """Pause a task (end current session)"""
    task = await task_service.pause_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found or not started"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Task paused successfully"
    )


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: str):
    """Complete a task"""
    task = await task_service.complete_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Task completed successfully"
    )


@router.post("/{task_id}/abandon", response_model=TaskResponse)
async def abandon_task(task_id: str):
    """Mark a task as abandoned"""
    task = await task_service.abandon_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Task marked as abandoned"
    )


@router.post("/{task_id}/interventions/log", response_model=TaskResponse)
async def log_intervention(task_id: str, intervention_data: InterventionLogRequest):
    """Log intervention display and user response for ML training"""
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    # Log to ML training collection
    from services.ml_training_service import ml_training_service
    await ml_training_service.log_intervention_event(
        task=task,
        intervention_type=intervention_data.intervention_type,
        intervention_accepted=intervention_data.intervention_accepted,
        session_duration_minutes=intervention_data.session_duration_minutes
    )

    # Also update task's interventionHistory (preserve existing behavior)
    intervention_entry = InterventionHistory(
        timestamp=int(time.time() * 1000),
        type=intervention_data.intervention_type,
        reason="intervention_displayed",
        message=f"Intervention {intervention_data.intervention_type} {'accepted' if intervention_data.intervention_accepted else 'rejected'}"
    )

    result = await task_service.collection.find_one_and_update(
        {"id": task_id},
        {"$push": {"interventionHistory": intervention_entry.model_dump()}},
        return_document=True
    )

    return TaskResponse(
        success=True,
        task=Task(**result),
        message="Intervention logged successfully"
    )


@router.post("/{task_id}/subtasks", response_model=TaskResponse)
async def add_subtask(task_id: str, subtask_data: SubtaskCreate):
    """Add a subtask to a task"""
    task = await task_service.add_subtask(task_id, subtask_data)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Subtask added successfully"
    )


@router.post("/{task_id}/subtasks/{subtask_id}/toggle", response_model=TaskResponse)
async def toggle_subtask(task_id: str, subtask_id: str):
    """Toggle subtask completion"""
    task = await task_service.toggle_subtask(task_id, subtask_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    return TaskResponse(
        success=True,
        task=task,
        message="Subtask toggled successfully"
    )


@router.get("/{task_id}/active")
async def get_active_task():
    """Get currently active task"""
    task = await task_service.get_active_task()
    if not task:
        return TaskResponse(
            success=True,
            task=None,
            message="No active task"
        )
    return TaskResponse(success=True, task=task)
