import uuid
import random
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Optional, Dict
from models.intervention import (
    InterventionContext, 
    InterventionType, 
    InterventionProposal, 
    TrainingDataPoint
)
from models.tmt import TMTMetrics

# Placeholder for the global ML model
# In a real app, this would be loaded from a pickle file on startup
_XGB_MODEL = None 
_INTERVENTION_HISTORY = [] # In-memory storage for now (replace with DB)

class MLService:
    def __init__(self):
        self.intervention_types = list(InterventionType)

    def _get_heuristic_suggestion(self, context: InterventionContext) -> InterventionType:
        """
        Cold-start logic: Simple rules when we don't have enough data for ML.
        """
        scores = context.tmt_scores
        
        # Rule 1: High Impulsiveness -> Strict structure (Pomodoro)
        if scores.impulsiveness > 0.7:
            return InterventionType.POMODORO
            
        # Rule 2: Low Expectancy (Self-doubt) -> Low barrier (2 Minute Rule)
        if scores.expectancy < 0.3:
            return InterventionType.TWO_MINUTE_RULE
            
        # Rule 3: Low Value (Boredom) -> Reconnect with goals (Reframing)
        if scores.value < 0.3:
            return InterventionType.REFRAMING
            
        # Rule 4: Long session without breaks -> Take a break
        if context.time_since_last_break_minutes > 60:
            return InterventionType.BREAK
            
        # Default
        return InterventionType.NOTIFICATION

    def suggest_intervention(self, context: InterventionContext) -> InterventionProposal:
        """
        Decides the best intervention using Epsilon-Greedy strategy.
        """
        epsilon = 0.2 # 20% exploration (random), 80% exploitation (best model/heuristic)
        
        intervention_type = None
        predicted_score = 0.0

        if random.random() < epsilon:
            # Exploration: Pick random
            intervention_type = random.choice(self.intervention_types)
        else:
            # Exploitation: Use Model or Heuristic
            if _XGB_MODEL:
                # TODO: Implement XGBoost prediction logic here
                # For now, fallback to heuristic even in exploitation branch until model is trained
                intervention_type = self._get_heuristic_suggestion(context)
            else:
                intervention_type = self._get_heuristic_suggestion(context)

        # Generate specific message based on type
        messages = {
            InterventionType.POMODORO: "Distraction is high. Let's try a strict 25-minute Pomodoro.",
            InterventionType.TWO_MINUTE_RULE: "Task seems daunting? Just commit to doing it for 2 minutes.",
            InterventionType.BREATHING: "You seem stressed. Take 3 deep breaths.",
            InterventionType.REFRAMING: "Why is this task important? Remind yourself of the goal.",
            InterventionType.BREAK: "You've been working for a while. Time for a quick recharge.",
            InterventionType.NOTIFICATION: "Gentle nudge: Are you still on track?"
        }

        # Store the context in memory (keyed by ID) to join with outcome later
        intervention_id = str(uuid.uuid4())
        
        # In a real app, save 'context' to DB here with 'intervention_id'
        
        return InterventionProposal(
            id=intervention_id,
            type=intervention_type,
            message=messages.get(intervention_type, "Let's focus."),
            predicted_efficacy=0.5 # Placeholder
        )

    def log_outcome(self, intervention_id: str, motivation_after: float, accepted: bool):
        """
        Receives the result of the intervention to complete the training loop.
        """
        # In a real app:
        # 1. Fetch the original 'context' using intervention_id
        # 2. Calculate delta = motivation_after - context.tmt_scores.motivation
        # 3. Save as TrainingDataPoint
        pass

    def train_model(self):
        """
        Scheduled task to retrain XGBoost on collected history.
        """
        pass

ml_service = MLService()
