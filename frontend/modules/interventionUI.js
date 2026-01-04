/**
 * Intervention UI
 * - Handles System Notifications via IPC
 * - Renders In-App Modals for interventions
 */

const InterventionUI = {

    /**
     * Show a system notification
     * @param {string} title 
     * @param {string} body 
     */
    showNotification(title, body) {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('notify:intervention', { title, body });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            // Browser fallback
            new Notification(title, { body });
        }
    },

    /**
     * Show an in-app modal with an intervention strategy
     * @param {string} strategy - 'pomodoro', '2_minute_rule', etc.
     * @param {Object} content - { title, body, taskId }
     */
    showInterventionModal(strategy, content) {
        const modal = document.createElement('div');
        modal.className = 'intervention-modal-backdrop';
        modal.id = 'activeInterventionModal';

        let actionButtonText = "Let's do it";
        if (strategy === 'pomodoro') actionButtonText = "Start Timer";
        if (strategy === '2_minute_rule') actionButtonText = "Start 2 Minutes";
        if (strategy === 'just_start') actionButtonText = "Start Small";
        if (strategy === 'breathing') actionButtonText = "Start Breathing";
        if (strategy === 'visualization') actionButtonText = "Close Eyes";
        if (strategy === 'reframe') actionButtonText = "Got it";

        modal.innerHTML = `
            <div class="intervention-modal animate-pop-in">
                <div class="intervention-header">
                    <span class="intervention-icon">💡</span>
                    <h3>${content.title}</h3>
                </div>
                <div class="intervention-body">
                    <p>${content.body}</p>
                </div>
                <div class="intervention-actions">
                    <button class="btn btn-secondary" id="interventionDismiss">Skip</button>
                    <button class="btn btn-primary" id="interventionAction">${actionButtonText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event Listeners
        document.getElementById('interventionDismiss').addEventListener('click', () => {
            InterventionManager.recordOutcome(content.taskId, 'rejected');
            this.closeModal();
        });

        document.getElementById('interventionAction').addEventListener('click', () => {
            InterventionManager.recordOutcome(content.taskId, 'accepted');
            this.handleStrategyAction(strategy, content.taskId);
            this.closeModal();
        });
    },

    /**
     * Close the modal
     */
    closeModal() {
        const modal = document.getElementById('activeInterventionModal');
        if (modal) {
            modal.remove();
        }
    },

    /**
     * Handle the specific action for a strategy
     */
    handleStrategyAction(strategy, taskId) {
        if (strategy === 'pomodoro') {
            // Start Pomodoro logic (reuse TaskManager startTask)
            // Ideally set a timer UI, but for now just ensure task is started
            window.handleStartTask(taskId);
            alert("Pomodoro timer started! (Simulated)");
        } else if (strategy === '2_minute_rule') {
            window.handleStartTask(taskId);
            alert("2 Minute timer started! Just focus for 2 mins.");
        } else if (strategy === 'just_start') {
            window.handleStartTask(taskId);
            alert("Great! Just focus on one tiny part of the task.");
        } else if (strategy === 'breathing') {
            alert("Take a deep breath in... hold... and out. (Do this 3 times, then resume).");
            window.handleStartTask(taskId);
        } else if (strategy === 'visualization') {
            alert("Close your eyes for 30 seconds. Imagine the relief of finishing this task.");
            window.handleStartTask(taskId);
        } else if (strategy === 'reframe') {
            window.handleStartTask(taskId);
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.InterventionUI = InterventionUI;
}
