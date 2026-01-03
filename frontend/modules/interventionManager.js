/**
 * Intervention Manager
 * - Detects Motivation Drops based on TMT history
 * - Suggests Interventions (ML-driven via Backend)
 * - Tracks effectiveness for future ML training
 */

const BACKEND_URL = 'http://localhost:8000/api/v1';

const INTERVENTION_TYPES = {
    NOTIFICATION: 'notification',
    MODAL: 'modal'
};

const STRATEGIES = {
    TWO_MINUTE_RULE: 'two_minute_rule',
    POMODORO: 'pomodoro',
    BREATHING: 'breathing',
    REFRAMING: 'reframing',
    BREAK: 'break',
    NOTIFICATION: 'notification'
};

const InterventionManager = {

    /**
     * Analyze if a drop in motivation warrants an intervention
     * @param {Object} task - The task object
     * @param {Object} oldTMT - Previous TMT values
     * @param {Object} newTMT - Current TMT values
     */
    async analyzeDrop(task, oldTMT, newTMT) {
        if (!oldTMT || !newTMT) return;

        const oldMot = oldTMT.motivation;
        const newMot = newTMT.motivation;

        // Drop detection logic
        const drop = oldMot - newMot;

        // Thresholds
        const SMALL_DROP_THRESHOLD = 0.5; // e.g., 6.0 -> 5.5
        const LARGE_DROP_THRESHOLD = 1.5; // e.g., 6.0 -> 4.5

        if (drop >= LARGE_DROP_THRESHOLD) {
            await this.triggerIntervention(task, 'large_drop');
        } else if (drop >= SMALL_DROP_THRESHOLD) {
            await this.triggerIntervention(task, 'small_drop');
        }
    },

    /**
     * Trigger an intervention based on the type of drop
     * @param {Object} task 
     * @param {string} triggerType 
     */
    async triggerIntervention(task, triggerType) {
        console.log(`[InterventionManager] Triggering intervention for ${task.text} (${triggerType})`);

        try {
            // Prepare context for ML model
            const context = {
                task_id: task.id,
                tmt_scores: {
                    expectancy: task.expectancy || 0.5,
                    value: task.value || 0.5,
                    impulsiveness: task.impulsivity || 0.5, // Note: frontend uses 'impulsivity', backend 'impulsiveness'
                    delay: task.delay || 0.5,
                    motivation: task.tmtScore || 0.5
                },
                time_of_day_hour: new Date().getHours(),
                day_of_week: new Date().getDay(),
                session_duration_minutes: TaskManager.getSessionDuration(task.id) || 0,
                time_since_last_break_minutes: TaskManager.getTimeSinceLastBreak(task.id) || 0,
                recent_procrastination_count: task.procrastinationCount || 0
            };

            // Call Backend ML Service
            const response = await fetch(`${BACKEND_URL}/interventions/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(context)
            });

            if (!response.ok) throw new Error('Backend error');

            const proposal = await response.json();
            
            // Map backend proposal to UI
            this.handleProposal(task, proposal, triggerType);

        } catch (error) {
            console.warn('[InterventionManager] Backend unavailable, using local heuristics:', error);
            this.fallbackHeuristics(task, triggerType);
        }
    },

    /**
     * Handle the proposal returned from the backend
     */
    handleProposal(task, proposal, triggerType) {
        const { id, type, message } = proposal;

        // Store intervention ID for feedback
        this.currentInterventionId = id;
        this.currentInterventionStartMotivation = task.tmtScore || 0;

        if (type === 'notification') {
            InterventionUI.showNotification("Focus Nudge", message);
            this.logIntervention(task.id, triggerType, 'notification', 'notification', id);
        } else {
            // All other types show as a modal
            InterventionUI.showInterventionModal(type, { 
                title: "Suggestion", 
                body: message, 
                taskId: task.id,
                interventionId: id 
            });
            this.logIntervention(task.id, triggerType, 'modal', type, id);
        }
    },

    /**
     * Fallback logic when backend is down
     */
    fallbackHeuristics(task, triggerType) {
        let type, strategy, title, body;
        
        // Simple local ID generation
        const localId = 'local_' + Date.now();

        if (triggerType === 'small_drop') {
            InterventionUI.showNotification("Keep Going!", `You're doing great on "${task.text}". Just 5 more minutes?`);
            this.logIntervention(task.id, triggerType, 'notification', 'simple_nudge', localId);
        } else {
            if (task.impulsivity > 7) {
                strategy = STRATEGIES.POMODORO;
                title = "Distracted?";
                body = "Let's try a Pomodoro session. 25 minutes of focus, then a break.";
            } else {
                strategy = STRATEGIES.TWO_MINUTE_RULE;
                title = "Feeling Stuck?";
                body = "Try the 2-Minute Rule: Do the task for just 2 minutes.";
            }

            InterventionUI.showInterventionModal(strategy, { 
                title, 
                body, 
                taskId: task.id,
                interventionId: localId
            });
            
            this.logIntervention(task.id, triggerType, 'modal', strategy, localId);
        }
    },

    /**
     * Log intervention triggering 
     */
    logIntervention(taskId, trigger, type, strategy, interventionId) {
        if (typeof TaskManager !== 'undefined') {
            const task = TaskManager.getTaskById(taskId);
            if (task) {
                if (!task.interventionHistory) task.interventionHistory = [];
                task.interventionHistory.push({
                    interventionId,
                    timestamp: Date.now(),
                    trigger,
                    type,
                    strategy,
                    outcome: 'pending'
                });
                TaskManager.saveTasks();
            }
        }
    },

    /**
     * Record the outcome of an intervention and send to backend
     * @param {string} taskId 
     * @param {string} outcome - 'accepted', 'rejected'
     * @param {string} interventionId - ID from the backend
     */
    async recordOutcome(taskId, outcome, interventionId) {
        const task = TaskManager.getTaskById(taskId);
        
        // 1. Update local history
        if (task && task.interventionHistory) {
            const entry = task.interventionHistory.find(i => i.interventionId === interventionId);
            if (entry) {
                entry.outcome = outcome;
                TaskManager.saveTasks();
            }
        }
        
        // 2. Send feedback to backend
        try {
            // Get current motivation to calculate delta
            // Note: In a real app, the backend might query the motivation state directly or we pass it
            const currentMotivation = task.tmtScore || 0;
            
            await fetch(`${BACKEND_URL}/interventions/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intervention_id: interventionId,
                    accepted: outcome === 'accepted',
                    motivation_after_5min: currentMotivation // We send current state, backend compares
                })
            });
            console.log(`[InterventionManager] Feedback sent for ${interventionId}`);
        } catch (e) {
            console.warn('[InterventionManager] Failed to send feedback:', e);
        }
    }
};

// Export to window
if (typeof window !== 'undefined') {
    window.InterventionManager = InterventionManager;
}
