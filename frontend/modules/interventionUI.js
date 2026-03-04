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
     * @param {Object} content - { title, body, onAccept, onReject }
     */
    showInterventionModal(strategy, content) {
        const modal = document.createElement('div');
        modal.className = 'intervention-modal-backdrop';
        modal.id = 'activeInterventionModal';

        let actionButtonText = "Let's do it";
        if (strategy === 'pomodoro') actionButtonText = "Start Timer";
        if (strategy === '2_minute_rule') actionButtonText = "Start 2 Minutes";
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
            if (content.onReject) content.onReject();
            this.closeModal();
        });

        document.getElementById('interventionAction').addEventListener('click', () => {
            if (content.onAccept) content.onAccept();
            this.handleStrategyAction(strategy, content.onAccept);
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
    handleStrategyAction(strategy, callback) {
        if (strategy === 'breathing') {
            this.showBreathingExercise(callback);
        }
        // Other strategies are handled by the callback passed in content.onAccept
    },

    /**
     * Show breathing exercise modal with animation
     * @param {Function} onComplete - Optional callback to run after breathing
     */
    showBreathingExercise(onComplete = null) {
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
        let breathingTimer = null;

        modal.innerHTML = `
            <div class="breathing-container">
                <div class="breathing-circle"></div>
                <div class="breathing-text" id="breathingText">Breathe In</div>
                <div class="breathing-instruction" id="breathingInstruction">Slowly inhale through your nose</div>
                <div class="breathing-counter" id="breathingCounter">Cycle 1 of 3</div>
                <div class="breathing-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn btn-secondary" id="breathingCancel">Cancel</button>
                    <button class="breathing-close-btn" id="breathingClose" style="display:none;">Complete</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const updateBreathingState = () => {
            if (!document.getElementById('breathingModal')) return;

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
                    // Show complete button and hide cancel
                    document.getElementById('breathingClose').style.display = 'block';
                    document.getElementById('breathingCancel').style.display = 'none';
                    return;
                }
            }

            breathingTimer = setTimeout(updateBreathingState, state.duration);
        };

        // Start the breathing cycle
        breathingTimer = setTimeout(updateBreathingState, breathingStates[0].duration);

        // Close button handler
        document.getElementById('breathingClose').addEventListener('click', () => {
            clearTimeout(breathingTimer);
            modal.remove();
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }
        });

        // Cancel button handler
        document.getElementById('breathingCancel').addEventListener('click', () => {
            clearTimeout(breathingTimer);
            modal.remove();
            console.log('Breathing exercise cancelled');
        });
    }
};

// Export
if (typeof window !== 'undefined') {
    window.InterventionUI = InterventionUI;
}
