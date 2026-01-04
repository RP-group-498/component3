from fastapi import APIRouter, HTTPException, Depends
from typing import Dict
from services.intervention_service import intervention_service
from services.task_service import task_service
from models.task import Task
from services.ml_training_service import ml_training_service

router = APIRouter()

@router.post("/suggest/{task_id}")
async def suggest_intervention(task_id: str, trigger_context: Dict):
    """
    Suggest an intervention for a specific task based on current state.
    trigger_context expects: { "trigger_type": "small_drop" | "large_drop" }
    """
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    trigger_type = trigger_context.get("trigger_type", "small_drop")
    
    suggestion = await intervention_service.suggest_intervention(task, trigger_type)
    
    return suggestion

@router.post("/{task_id}/log")
async def log_intervention(task_id: str, data: Dict):
    """
    Log an intervention outcome (Accepted/Rejected) for ML training.
    """
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Delegate to the existing ML logging service
    # data expects: intervention_type, intervention_accepted, session_duration_minutes
    
    result = await ml_training_service.log_intervention_event(
        task=task,
        intervention_type=data.get("intervention_type"),
        intervention_accepted=data.get("intervention_accepted"),
        session_duration_minutes=data.get("session_duration_minutes", 0)
    )
    
    return result
