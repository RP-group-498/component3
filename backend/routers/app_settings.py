"""
App Settings and Timer State API router
"""
from fastapi import APIRouter, HTTPException, status
from models.app_settings import (
    AppSettings,
    AppSettingsUpdate,
    AppSettingsResponse,
    TimerState,
    TimerStateUpdate,
    TimerStateResponse
)
from services.app_settings_service import app_settings_service

router = APIRouter()


@router.get("/", response_model=AppSettingsResponse)
async def get_settings(user_id: str = "default"):
    """Get app settings"""
    settings = await app_settings_service.get_settings(user_id)
    return AppSettingsResponse(
        success=True,
        settings=settings
    )


@router.put("/", response_model=AppSettingsResponse)
async def update_settings(updates: AppSettingsUpdate, user_id: str = "default"):
    """Update app settings"""
    settings = await app_settings_service.update_settings(updates, user_id)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )
    return AppSettingsResponse(
        success=True,
        settings=settings,
        message="Settings updated successfully"
    )


# Timer state endpoints
@router.get("/timer", response_model=TimerStateResponse)
async def get_timer_state(user_id: str = "default"):
    """Get current timer state"""
    timer_state = await app_settings_service.get_timer_state(user_id)
    return TimerStateResponse(
        success=True,
        timerState=timer_state
    )


@router.put("/timer", response_model=TimerStateResponse)
async def update_timer_state(updates: TimerStateUpdate, user_id: str = "default"):
    """Update timer state"""
    timer_state = await app_settings_service.update_timer_state(updates, user_id)
    if not timer_state:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update timer state"
        )
    return TimerStateResponse(
        success=True,
        timerState=timer_state,
        message="Timer state updated successfully"
    )


@router.delete("/timer", response_model=TimerStateResponse)
async def clear_timer_state(user_id: str = "default"):
    """Clear/reset timer state"""
    success = await app_settings_service.clear_timer_state(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear timer state"
        )
    return TimerStateResponse(
        success=True,
        timerState=None,
        message="Timer state cleared successfully"
    )


# Active session endpoints (for crash recovery)
@router.post("/active-session")
async def save_active_session(task_id: str, start_time: int, user_id: str = "default"):
    """Save active session for crash recovery"""
    active_session = await app_settings_service.save_active_session(
        task_id, start_time, user_id
    )
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save active session"
        )
    return {
        "success": True,
        "activeSession": active_session,
        "message": "Active session saved successfully"
    }


@router.get("/active-session")
async def get_active_session(user_id: str = "default"):
    """Get active session recovery data"""
    active_session = await app_settings_service.get_active_session(user_id)
    return {
        "success": True,
        "activeSession": active_session
    }


@router.delete("/active-session")
async def clear_active_session(user_id: str = "default"):
    """Clear active session data"""
    success = await app_settings_service.clear_active_session(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear active session"
        )
    return {
        "success": True,
        "message": "Active session cleared successfully"
    }
