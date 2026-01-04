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
            this.showBreathingExercise(taskId);
        } else if (strategy === 'visualization') {
            alert("Close your eyes for 30 seconds. Imagine the relief of finishing this task.");
            window.handleStartTask(taskId);
        } else if (strategy === 'reframe') {
            window.handleStartTask(taskId);
        }
    },

    /**
     * Show breathing exercise modal with animation
     * @param {string} taskId - Optional task ID to start after breathing
     */
    showBreathingExercise(taskId = null) {
        const modal = document.createElement('div');
        modal.className = 'breathing-modal';
        modal.id = 'breathingModal';

        const breathingStates = [
            { text: 'Breathe In', instruction: 'Slowly inhale through your nose', duration: 4000 },
            { text: 'Hold', instruction: 'Hold your breath', duration: 2000 },
            { text: 'Breathe Out', instruction: 'Slowly exhale through your mouth', duration: 4000 },
            { text: 'Hold', instruction: 'Hold your breath', duration: 2000 }
        ];

        let currentCycle = 0;
        const totalCycles = 3;
        let currentState = 0;

        modal.innerHTML = `
            <div class="breathing-container">
                <div class="breathing-circle"></div>
                <div class="breathing-text" id="breathingText">Breathe In</div>
                <div class="breathing-instruction" id="breathingInstruction">Slowly inhale through your nose</div>
                <div class="breathing-counter" id="breathingCounter">Cycle 1 of 3</div>
                <button class="breathing-close-btn" id="breathingClose" style="display:none;">Complete</button>
            </div>
        `;

        document.body.appendChild(modal);

        const updateBreathingState = () => {
            const state = breathingStates[currentState];
            document.getElementById('breathingText').textContent = state.text;
            document.getElementById('breathingInstruction').textContent = state.instruction;

            currentState++;
            if (currentState >= breathingStates.length) {
                currentState = 0;
                currentCycle++;
                document.getElementById('breathingCounter').textContent =
                    currentCycle < totalCycles ? `Cycle ${currentCycle + 1} of ${totalCycles}` : 'Complete!';

                if (currentCycle >= totalCycles) {
                    // Show complete button
                    document.getElementById('breathingClose').style.display = 'block';
                    return;
                }
            }

            setTimeout(updateBreathingState, state.duration);
        };

        // Start the breathing cycle
        setTimeout(updateBreathingState, breathingStates[0].duration);

        // Close button handler
        document.getElementById('breathingClose').addEventListener('click', () => {
            modal.remove();
            if (taskId && window.handleStartTask) {
                window.handleStartTask(taskId);
            }
        });
    }
};

// Export
if (typeof window !== 'undefined') {
    window.InterventionUI = InterventionUI;
}
