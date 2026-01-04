/**
 * Intervention UI
 * - Handles System Notifications via IPC
 * - Renders In-App Modals for interventions
 */

const InterventionUI = {

    /**
     * Show a system notification with optional action buttons
     * @param {string} title
     * @param {string} body
     * @param {Array} actions - Optional action buttons [{ type: 'accept', text: 'Start' }, { type: 'reject', text: 'Skip' }]
     * @param {Object} metadata - Optional metadata (taskId, interventionId, strategy)
     */
    showNotification(title, body, actions = null, metadata = null) {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('notify:intervention', {
                title,
                body,
                actions,
                metadata
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            // Browser fallback (no action support)
            new Notification(title, { body });
        }
    },

    /**
     * Show an in-app modal with an intervention strategy
     * @param {string} strategy - 'pomodoro', 'two_minute_rule', 'breathing', 'reframing', 'break'
     * @param {Object} content - { title, body, taskId, interventionId }
     */
    showInterventionModal(strategy, content) {
        const modal = document.createElement('div');
        modal.className = 'intervention-modal-backdrop';
        modal.id = 'activeInterventionModal';

        // Get icon and button text for each strategy
        const strategyConfig = this.getStrategyConfig(strategy);

        modal.innerHTML = `
            <div class="intervention-modal animate-pop-in">
                <div class="intervention-header">
                    <span class="intervention-icon">${strategyConfig.icon}</span>
                    <h3>${content.title}</h3>
                </div>
                <div class="intervention-body">
                    <p>${content.body}</p>
                </div>
                <div class="intervention-actions">
                    <button class="btn btn-secondary" id="interventionDismiss">Skip</button>
                    <button class="btn btn-primary" id="interventionAction">${strategyConfig.actionText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event Listeners
        document.getElementById('interventionDismiss').addEventListener('click', () => {
            InterventionManager.recordOutcome(content.taskId, 'rejected', content.interventionId);
            this.closeModal();
        });

        document.getElementById('interventionAction').addEventListener('click', () => {
            InterventionManager.recordOutcome(content.taskId, 'accepted', content.interventionId);
            this.handleStrategyAction(strategy, content.taskId);
            this.closeModal();
        });
    },

    /**
     * Get configuration for each strategy type
     * @param {string} strategy
     * @returns {Object} { icon, actionText, actions }
     */
    getStrategyConfig(strategy) {
        const configs = {
            'pomodoro': {
                icon: '🍅',
                actionText: 'Start 25min Timer',
                actions: [
                    { type: 'accept', text: 'Start Timer' },
                    { type: 'reject', text: 'Skip' }
                ]
            },
            'two_minute_rule': {
                icon: '⏱️',
                actionText: 'Start 2 Minutes',
                actions: [
                    { type: 'accept', text: 'Start 2 Min' },
                    { type: 'reject', text: 'Skip' }
                ]
            },
            'breathing': {
                icon: '🧘',
                actionText: 'Start Breathing',
                actions: [
                    { type: 'accept', text: 'Start' },
                    { type: 'reject', text: 'Skip' }
                ]
            },
            'reframing': {
                icon: '💭',
                actionText: 'I Got This!',
                actions: [
                    { type: 'accept', text: 'Got It!' },
                    { type: 'reject', text: 'Skip' }
                ]
            },
            'break': {
                icon: '☕',
                actionText: 'Take a Break',
                actions: [
                    { type: 'accept', text: 'Take Break' },
                    { type: 'reject', text: 'Continue' }
                ]
            },
            'notification': {
                icon: '💡',
                actionText: 'Got It!',
                actions: [
                    { type: 'accept', text: 'OK' }
                ]
            }
        };

        return configs[strategy] || {
            icon: '💡',
            actionText: "Let's do it",
            actions: [
                { type: 'accept', text: 'OK' },
                { type: 'reject', text: 'Skip' }
            ]
        };
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
        // Start the task if not already started
        const task = TaskManager.getTaskById(taskId);
        if (task && task.status !== 'started') {
            window.handleStartTask(taskId);
        }

        // Strategy-specific actions
        switch(strategy) {
            case 'pomodoro':
                this.showNotification('🍅 Pomodoro Started', 'Focus for 25 minutes, then take a 5-minute break!');
                // TODO: Implement actual 25-minute timer
                break;

            case 'two_minute_rule':
                this.showNotification('⏱️ 2-Minute Rule Active', 'Just 2 minutes of focus. You can do this!');
                // TODO: Implement 2-minute timer
                break;

            case 'breathing':
                this.showNotification('🧘 Breathing Exercise', 'Breathe in (4s), hold (4s), breathe out (4s). Repeat 3 times.');
                // TODO: Show breathing animation/timer
                break;

            case 'reframing':
                this.showNotification('💭 Positive Mindset', 'Focus on the value this task brings to your goals!');
                break;

            case 'break':
                this.showNotification('☕ Break Time', 'Take 5 minutes to stretch, hydrate, or relax.');
                // TODO: Implement break timer
                break;

            default:
                this.showNotification('✅ Let\'s Go!', 'Time to focus and make progress!');
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.InterventionUI = InterventionUI;
}
