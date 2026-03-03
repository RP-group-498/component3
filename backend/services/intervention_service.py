"""
Intervention Service
Suggests the best intervention based on task state and user history.
Acts as a bridge between rule-based logic and full ML prediction.
"""
from typing import Dict, Optional, List
from models.task import Task
from services.ml_training_service import ml_training_service
import random

class InterventionService:
    """
    Service to determine the optimal intervention strategy.
    Currently uses 'Smart Heuristics' and 'Historical Success Rates'.
    Future: Will load a trained ML model.
    """

    INTERVENTION_TYPES = {
        "notification": "notification",
        "modal": "modal",
        "ambient": "ambient",  # New: Subtle background changes
        "sound": "sound"       # New: Audio cue
    }

    STRATEGIES = {
        "2_minute_rule": "2_minute_rule",
        "pomodoro": "pomodoro",
        "break_down": "break_down",
        "just_start": "just_start",
        "breathing": "breathing",         
        "visualization": "visualization", 
        "reframe": "reframe"              
    }

    async def suggest_intervention(self, task: Task, trigger_type: str) -> Dict:
        """
        Suggest the best intervention based on context.
        """
        
        # 1. Fetch recent history to see what worked
        # We look at the last 10 interventions for this task or overall
        history = await ml_training_service.get_training_data(limit=50)
        
        # Filter for this user's general preferences (simplified as just global history for now)
        accepted_interventions = [h for h in history if h.intervention_accepted]
        
        # 2. Analyze the 'Drop' context
        # small_drop vs large_drop
        
        if trigger_type == 'small_drop':
            return self._handle_small_drop(task, accepted_interventions)
        elif trigger_type == 'large_drop':
            return self._handle_large_drop(task, accepted_interventions)
        
        # Default fallback
        return {
            "type": self.INTERVENTION_TYPES["notification"],
            "strategy": self.STRATEGIES["just_start"],
            "title": "Keep it up",
            "body": "You are doing great."
        }

    def _handle_small_drop(self, task: Task, history: List) -> Dict:
        """
        For small drops, we prefer subtle interventions.
        """
        # Heuristic: If Impulsiveness is very high, even a small drop might need a stronger check.
        # But generally, use Notifications or Ambient.
        
        # Check if "breathing" has worked recently
        breathing_success = any(h.intervention_type == 'breathing' for h in history)
        
        if breathing_success:
             return {
                "type": self.INTERVENTION_TYPES["notification"],
                "strategy": self.STRATEGIES["breathing"],
                "title": "Take a Breath",
                "body": "Focus is slipping slightly. Take one deep breath."
            }
            
        return {
            "type": self.INTERVENTION_TYPES["notification"],
            "strategy": self.STRATEGIES["just_start"],
            "title": "Stay with it",
            "body": f"You're working on {task.text}. Keep the momentum."
        }

    def _handle_large_drop(self, task: Task, history: List) -> Dict:
        """
        For large drops, we need stronger interventions (Modals, Pomodoro).
        Logic attempts to diagnose the *cause* of the drop using TMT components.
        """
        
        # Diagnosis
        is_impulsive = task.impulsivity > 6
        is_low_expectancy = task.expectancy < 4
        is_high_delay = task.delay > 7
        
        # "The Pattern Break" -> High Impulsivity
        if is_impulsive:
            return {
                "type": self.INTERVENTION_TYPES["modal"],
                "strategy": self.STRATEGIES["pomodoro"],
                "title": "Distraction Detected",
                "body": "Impulsivity is high. Let's structure time with a Pomodoro (25m)."
            }
            
        # "The Reality Check" -> Low Expectancy (User thinks they can't do it)
        if is_low_expectancy:
             return {
                "type": self.INTERVENTION_TYPES["modal"],
                "strategy": self.STRATEGIES["break_down"],
                "title": "Feeling Overwhelmed?",
                "body": "Expectancy is low. Let's break this task into smaller, manageable pieces."
            }

        # "The Reframe" -> High Delay (Deadline is far, motivation low)
        if is_high_delay:
             return {
                "type": self.INTERVENTION_TYPES["modal"],
                "strategy": self.STRATEGIES["visualization"],
                "title": "Visualize the End",
                "body": "The deadline is far, but imagine the relief of finishing this early."
            }
            
        # Default for large drops: 2 Minute Rule
        return {
            "type": self.INTERVENTION_TYPES["modal"],
            "strategy": self.STRATEGIES["2_minute_rule"],
            "title": "Stuck?",
            "body": "Just do it for 2 minutes. That's all."
        }

# Global Service
intervention_service = InterventionService()
