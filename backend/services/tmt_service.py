"""
TMT (Temporal Motivation Theory) service
Simplified version - full logic can be ported from tmtEngine.js
"""
import math
from typing import List, Optional
from models.task import Task
from models.tmt import TMTMetrics, TMTRawMetrics


class TMTService:
    """TMT calculation service"""
    
    def calculate_tmt(self, task: Task, all_tasks: List[Task]) -> dict:
        """
        Calculate TMT metrics for a task
        This is a simplified version - full logic should be ported from tmtEngine.js
        """
        
        # Calculate Expectancy (0-10)
        # Based on success rate and task complexity
        success_rate = self._calculate_success_rate(all_tasks)
        task_complexity = 5.0  # Default, can be enhanced
        expectancy = (success_rate * 0.7 + (10 - task_complexity) * 0.3)
        
        # Calculate Value (0-10)
        # Based on task value and personal relevance
        task_value = 5.0  # Default, can be enhanced based on category
        personal_relevance = 5.0  # Default
        value = (task_value * 0.6 + personal_relevance * 0.4)
        
        # Calculate Impulsiveness (0-10)
        # Based on user's behavioral patterns
        base_impulsiveness = 5.0  # Default
        distraction_level = self._calculate_distraction_level(task)
        impulsiveness = (base_impulsiveness * 0.5 + distraction_level * 0.5)
        
        # Calculate Delay (0-10)
        # Based on time to deadline and task duration
        time_to_deadline = self._calculate_time_to_deadline(task)
        task_duration = task.estimatedDuration or 60  # Default 60 minutes
        delay = min(10, max(0, time_to_deadline / (task_duration * 60)))  # Normalize
        
        # Calculate Motivation using TMT formula: Motivation = (E × V) / (I × D)
        # Avoid division by zero
        denominator = max(0.1, impulsiveness * delay)
        motivation = (expectancy * value) / denominator
        
        # Normalize motivation to 0-10 scale
        motivation = min(10, max(0, motivation))
        
        raw_metrics = TMTRawMetrics(
            expectancy=expectancy,
            value=value,
            impulsiveness=impulsiveness,
            delay=delay,
            successRate=success_rate,
            taskComplexity=task_complexity,
            taskValue=task_value,
            personalRelevance=personal_relevance,
            baseImpulsiveness=base_impulsiveness,
            distractionLevel=distraction_level,
            timeToDeadline=time_to_deadline,
            taskDuration=task_duration
        )
        
        metrics = TMTMetrics(
            expectancy=round(expectancy, 2),
            value=round(value, 2),
            impulsiveness=round(impulsiveness, 2),
            delay=round(delay, 2),
            motivation=round(motivation, 2)
        )
        
        return {
            "metrics": metrics,
            "raw": raw_metrics
        }
    
    def _calculate_success_rate(self, all_tasks: List[Task]) -> float:
        """Calculate user's task success rate"""
        if not all_tasks:
            return 5.0  # Default
        
        completed = len([t for t in all_tasks if t.status == "completed"])
        total = len([t for t in all_tasks if t.status in ["completed", "abandoned"]])
        
        if total == 0:
            return 5.0
        
        return (completed / total) * 10
    
    def _calculate_distraction_level(self, task: Task) -> float:
        """Calculate distraction level from activity log"""
        if not task.activityLog:
            return 5.0  # Default
        
        # Count procrastinating activities
        total_activities = len(task.activityLog)
        procrastinating = len([a for a in task.activityLog if not a.isWorking])
        
        if total_activities == 0:
            return 5.0
        
        return (procrastinating / total_activities) * 10
    
    def _calculate_time_to_deadline(self, task: Task) -> float:
        """Calculate time to deadline in hours"""
        if not task.deadlineDate:
            return 168.0  # Default 1 week in hours
        
        # This is simplified - full implementation should parse deadlineDate and deadlineTime
        # For now, return a default value
        return 24.0  # Default 24 hours


# Global TMT service instance
tmt_service = TMTService()
