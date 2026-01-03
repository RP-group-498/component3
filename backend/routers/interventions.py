from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any

from models.intervention import (
    InterventionContext, 
    InterventionProposal, 
    InterventionOutcome
)
from services.ml_service import ml_service

router = APIRouter()

@router.post("/suggest", response_model=InterventionProposal)
async def suggest_intervention(context: InterventionContext):
    """
    Analyzes the user's current context (TMT scores, time, etc.)
    and suggests the optimal intervention.
    """
    try:
        proposal = ml_service.suggest_intervention(context)
        return proposal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def log_intervention_feedback(outcome: InterventionOutcome):
    """
    Logs the outcome of an intervention (did it work?)
    to improve the ML model.
    """
    try:
        # In the future, this will update the model
        ml_service.log_outcome(
            intervention_id=outcome.intervention_id,
            motivation_after=outcome.motivation_after_5min,
            accepted=outcome.accepted
        )
        return {"status": "recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
