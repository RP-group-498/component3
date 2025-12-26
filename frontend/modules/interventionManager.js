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
     * @param {string} dropType 
     */
    triggerIntervention(task, dropType) {
        console.log(`[InterventionManager] Triggering intervention for ${task.text} (${dropType})`);

        // Heuristic Logic (Placeholder for ML Model)
        // Future: const { type, strategy } = await ML.predictBestIntervention(task, userProfile);

        let type, strategy, title, body;

        if (dropType === 'small_drop') {
            type = INTERVENTION_TYPES.NOTIFICATION;
            title = "Keep Going!";
            body = `You're doing great on "${task.text}". Just 5 more minutes?`;

            // Simple system notification
            InterventionUI.showNotification(title, body);

            // Log for ML
            this.logIntervention(task.id, 'small_drop', type, 'simple_nudge');

        } else if (dropType === 'large_drop') {
            type = INTERVENTION_TYPES.MODAL;

            // Choose strategy based on TMT component analysis (rudimentary)
            // If Impulsiveness is high -> Pomodoro
            // If Expectancy is low -> Break Down or 2-Min Rule

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
            // Log for ML
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
            }
        }
    },

    /**
     * Record the outcome of an intervention
     * @param {string} taskId 
     * @param {string} outcome - 'accepted', 'rejected', 'ignored', 'success'
     */
    recordOutcome(taskId, outcome) {
        const task = TaskManager.getTaskById(taskId);
        if (task && task.interventionHistory && task.interventionHistory.length > 0) {
            // Update the last intervention
            const lastIntervention = task.interventionHistory[task.interventionHistory.length - 1];
            lastIntervention.outcome = outcome;
            TaskManager.saveTasks();
            console.log(`[InterventionManager] Outcome recorded: ${outcome}`);
        }
    }
};

// Export to window
if (typeof window !== 'undefined') {
    window.InterventionManager = InterventionManager;
}
