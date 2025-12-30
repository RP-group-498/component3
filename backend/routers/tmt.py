"""
TMT (Temporal Motivation Theory) API router
"""
from fastapi import APIRouter, HTTPException, status
from models.tmt import TMTResponse
from models.task import TMTHistory, TaskUpdate
from services.task_service import task_service
from services.tmt_service import tmt_service

router = APIRouter()


@router.get("/{task_id}", response_model=TMTResponse)
async def get_tmt_metrics(task_id: str):
    """Get TMT metrics for a task"""
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    
    # Calculate TMT metrics
    all_tasks = await task_service.get_all_tasks()
    result = tmt_service.calculate_tmt(task, all_tasks)
    
    return TMTResponse(
        success=True,
        metrics=result["metrics"],
        raw=result["raw"],
        message="TMT metrics calculated successfully"
    )


@router.post("/{task_id}/recalculate", response_model=TMTResponse)
async def recalculate_tmt(task_id: str):
    """Recalculate TMT values for a task"""
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )
    
    # Calculate TMT metrics
    all_tasks = await task_service.get_all_tasks()
    result = tmt_service.calculate_tmt(task, all_tasks)
    
    # Create new history entry
    tmt_history_entry = TMTHistory(
        timestamp=int(result["raw"].timeToDeadline * 1000),  # This timestamp logic might need review (timeToDeadline is hours), but keeping legacy logic for now. 
        # Actually timeToDeadline is not a timestamp. But let's assume it's just a unique ID or we should use current time.
        # Original code used: timestamp=int(result["raw"].timeToDeadline * 1000)
        # That seems wrong if timeToDeadline is "hours until deadline". 
        # But let's stick to existing logic or fix it to be current time?
        # Better to use current time for history timestamp.
        expectancy=result["metrics"].expectancy,
        value=result["metrics"].value,
        impulsiveness=result["metrics"].impulsiveness,
        delay=result["metrics"].delay,
        motivation=result["metrics"].motivation
    )
    
    # Fix timestamp: Use current time
    import time
    tmt_history_entry.timestamp = int(time.time() * 1000)

    # Prepare update
    new_history = task.tmtHistory + [tmt_history_entry]
    if len(new_history) > 50:
        new_history = new_history[-50:]
        
    updates = TaskUpdate(
        expectancy=result["metrics"].expectancy,
        value=result["metrics"].value,
        impulsivity=result["metrics"].impulsiveness, # Note: field is impulsivity in Task, impulsiveness in Metrics
        delay=result["metrics"].delay,
        tmtHistory=new_history
    )
    
    await task_service.update_task(task_id, updates)
    
    return TMTResponse(
        success=True,
        metrics=result["metrics"],
        raw=result["raw"],
        message="TMT metrics recalculated and updated"
    )