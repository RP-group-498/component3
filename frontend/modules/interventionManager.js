/**
 * Intervention Manager
 * - Detects Motivation Drops based on TMT history
 * - Suggests Interventions (Rules-based initially, extensible for ML)
 * - Tracks effectiveness for future ML training
 */

const INTERVENTION_TYPES = {
    NOTIFICATION: 'notification',
    MODAL: 'modal'
};

const STRATEGIES = {
    TWO_MINUTE_RULE: '2_minute_rule',
    POMODORO: 'pomodoro',
    BREAK_DOWN: 'break_down',
    JUST_START: 'just_start'
};

const InterventionManager = {
    // Track pending intervention timers
    _interventionTimers: {},

    /**
     * Analyze if a drop in motivation warrants an intervention
     * @param {Object} task - The task object
     * @param {Object} oldTMT - Previous TMT values
     * @param {Object} newTMT - Current TMT values
     */
    analyzeDrop(task, oldTMT, newTMT) {
        if (!oldTMT || !newTMT) return;

        const oldMot = oldTMT.motivation;
        const newMot = newTMT.motivation;

        // Drop detection logic
        const drop = oldMot - newMot;

        // Thresholds
        const SMALL_DROP_THRESHOLD = 0.5; // e.g., 6.0 -> 5.5
        const LARGE_DROP_THRESHOLD = 1.5; // e.g., 6.0 -> 4.5

        if (drop >= LARGE_DROP_THRESHOLD) {
            this.triggerIntervention(task, 'large_drop');
        } else if (drop >= SMALL_DROP_THRESHOLD) {
            this.triggerIntervention(task, 'small_drop');
        }
    },

    /**
     * Trigger an intervention based on the type of drop
     * @param {Object} task 
     * @param {string} triggerType 
     * @param {number} score - Optional score associated with the trigger
     */
    async triggerIntervention(task, triggerType, score = 0) {
        console.log(`[InterventionManager] Triggering intervention for ${task.text} (${triggerType})`);

        try {
            // Call Backend ML Service
            const response = await fetch(`http://localhost:8000/api/v1/interventions/suggest/${task.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger_type: triggerType })
            });

            if (!response.ok) {
                throw new Error("Backend suggestion service failed");
            }

            const suggestion = await response.json();
            const { type, strategy, title, body } = suggestion;

            if (type === 'notification' || type === 'ambient') {
                InterventionUI.showNotification(title, body);
                this.logIntervention(task.id, triggerType, type, strategy);
            } else {
                InterventionUI.showInterventionModal(strategy, { title, body, taskId: task.id });
                this.logIntervention(task.id, triggerType, type, strategy);
            }

        } catch (error) {
            console.warn("[InterventionManager] Falling back to local heuristics:", error);
            this._triggerFallbackIntervention(task, triggerType);
        }
    },

    /**
     * Fallback heuristic logic if backend is unavailable
     */
    _triggerFallbackIntervention(task, triggerType) {
        let type, strategy, title, body;

        if (triggerType === 'small_drop') {
            type = INTERVENTION_TYPES.NOTIFICATION;
            title = "Keep Going!";
            body = `You're doing great on "${task.text}". Just 5 more minutes?`;

            InterventionUI.showNotification(title, body);
            this.logIntervention(task.id, 'small_drop', type, 'simple_nudge');

        } else if (triggerType === 'large_drop') {
            type = INTERVENTION_TYPES.MODAL;

            if (task.impulsivity > 7) {
                strategy = STRATEGIES.POMODORO;
                title = "Distracted?";
                body = "Let's try a Pomodoro session. 25 minutes of focus, then a break.";
            } else {
                strategy = STRATEGIES.TWO_MINUTE_RULE;
                title = "Feeling Stuck?";
                body = "Try the 2-Minute Rule: Do the task for just 2 minutes. Usually, that's enough to get flowing.";
            }

            InterventionUI.showInterventionModal(strategy, { title, body, taskId: task.id });
            this.logIntervention(task.id, 'large_drop', type, strategy);
        }
    },

    /**
     * Log intervention triggering for future ML training
     */
    logIntervention(taskId, trigger, type, strategy) {
        // In a real app, this would send data to a backend or analytics service
        // For now, we'll store it in the task's history for local ML
        if (typeof TaskManager !== 'undefined') {
            const task = TaskManager.getTaskById(taskId);
            if (task) {
                if (!task.interventionHistory) task.interventionHistory = [];
                task.interventionHistory.push({
                    timestamp: Date.now(),
                    trigger,
                    type,
                    strategy,
                    outcome: 'pending' // pending until user interaction
                });
                TaskManager.saveTasks();

                // Clear any existing timer for this task
                if (this._interventionTimers[taskId]) {
                    clearTimeout(this._interventionTimers[taskId]);
                }

                // Set 1-minute timeout - if user doesn't interact, count as rejected
                this._interventionTimers[taskId] = setTimeout(() => {
                    console.log(`[InterventionManager] Intervention timeout for task ${taskId} - logging as ignored`);
                    this.recordOutcome(taskId, 'ignored');
                    delete this._interventionTimers[taskId];
                }, 60000); // 60 seconds = 1 minute
            }
        }
    },

    /**
     * Record the outcome of an intervention
     * @param {string} taskId
     * @param {string} outcome - 'accepted', 'rejected', 'ignored', 'success'
     */
    recordOutcome(taskId, outcome) {
        // Clear the timeout timer if user interacted before 1 minute
        if (this._interventionTimers[taskId]) {
            clearTimeout(this._interventionTimers[taskId]);
            delete this._interventionTimers[taskId];
        }

        const task = TaskManager.getTaskById(taskId);
        if (task && task.interventionHistory && task.interventionHistory.length > 0) {
            // Update the last intervention
            const lastIntervention = task.interventionHistory[task.interventionHistory.length - 1];
            lastIntervention.outcome = outcome;
            TaskManager.saveTasks();

            // Log to backend for ML training
            // accepted = true only if outcome is 'accepted', false for 'rejected' or 'ignored'
            const accepted = (outcome === 'accepted');
            this.logInterventionToBackend(taskId, lastIntervention.strategy, accepted);

            console.log(`[InterventionManager] Outcome recorded: ${outcome}, accepted: ${accepted}`);
        }
    },

    /**
     * Log intervention to backend for ML training
     * @param {string} taskId
     * @param {string} frontendStrategy
     * @param {boolean} accepted
     */
    async logInterventionToBackend(taskId, frontendStrategy, accepted) {
        // Map frontend strategies to backend intervention types
        const typeMapping = {
            '2_minute_rule': 'task_suggestion',
            'pomodoro': 'break_reminder',
            'just_start': 'task_suggestion',
            'simple_nudge': 'motivation_boost',
            'break_down': 'task_suggestion'
        };

        const interventionType = typeMapping[frontendStrategy] || 'motivation_boost';

        // Calculate current session duration
        const task = TaskManager.getTaskById(taskId);
        const sessionDuration = task.currentSessionStart
            ? Math.floor((Date.now() - task.currentSessionStart) / 1000 / 60)
            : 0;

        try {
            const response = await fetch(`http://localhost:8000/api/v1/tasks/${taskId}/interventions/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intervention_type: interventionType,
                    intervention_accepted: accepted,
                    session_duration_minutes: sessionDuration
                })
            });

            if (!response.ok) {
                console.error('Failed to log intervention to backend');
            } else {
                console.log(`[InterventionManager] Logged to backend: ${interventionType}, accepted: ${accepted}`);
            }
        } catch (error) {
            console.error('Error logging intervention:', error);
        }
    }
};

// Export to window
if (typeof window !== 'undefined') {
    window.InterventionManager = InterventionManager;
}
