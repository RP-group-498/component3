/**
 * Renderer - Demo page for Intervention UI components
 */

console.log('[Demo] Initializing Intervention UI Demo...');

/**
 * Log intervention result to backend
 * @param {string} strategy 
 * @param {string} action 
 */
async function logToBackend(strategy, action) {
  try {
    const response = await fetch('http://localhost:8000/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ strategy, action }),
    });
    if (response.ok) {
      console.log(`[API] Logged ${strategy} ${action}`);
    } else {
      console.warn(`[API] Failed to log ${strategy} ${action}`, response.statusText);
    }
  } catch (error) {
    console.error(`[API] Error logging ${strategy} ${action}:`, error);
  }
}

// Intervention content for each strategy
const interventionContent = {
  '2_minute_rule': {
    title: 'Try the 2-Minute Rule',
    body: 'Commit to working on this for just 2 minutes. Often, starting is the hardest part!',
    onAccept: () => {
      console.log('User accepted: 2-Minute Rule');
      logToBackend('2_minute_rule', 'accept');
    },
    onReject: () => {
      console.log('User rejected: 2-Minute Rule');
      logToBackend('2_minute_rule', 'reject');
    }
  },
  'pomodoro': {
    title: 'Start a Pomodoro Session',
    body: 'Focus for 25 minutes, then take a 5-minute break. This helps maintain concentration.',
    onAccept: () => {
      console.log('User accepted: Pomodoro');
      logToBackend('pomodoro', 'accept');
    },
    onReject: () => {
      console.log('User rejected: Pomodoro');
      logToBackend('pomodoro', 'reject');
    }
  },
  'breathing': {
    title: 'Take a Breathing Break',
    body: 'A quick breathing exercise can help reduce stress and improve focus.',
    onAccept: () => {
      console.log('User accepted: Breathing');
      logToBackend('breathing', 'accept');
    },
    onReject: () => {
      console.log('User rejected: Breathing');
      logToBackend('breathing', 'reject');
    }
  },
  'visualization': {
    title: 'Visualize Completion',
    body: 'Close your eyes for 30 seconds. Imagine the relief and satisfaction of finishing this.',
    onAccept: () => {
      console.log('User accepted: Visualization');
      logToBackend('visualization', 'accept');
    },
    onReject: () => {
      console.log('User rejected: Visualization');
      logToBackend('visualization', 'reject');
    }
  },
  'reframe': {
    title: 'Reframe Your Perspective',
    body: 'Instead of "I have to do this," try "I choose to do this because it helps me [achieve goal]."',
    onAccept: () => {
      console.log('User accepted: Reframe');
      logToBackend('reframe', 'accept');
    },
    onReject: () => {
      console.log('User rejected: Reframe');
      logToBackend('reframe', 'reject');
    }
  }
};

// Set up demo button event listeners
document.addEventListener('DOMContentLoaded', () => {
  const demoButtons = document.querySelectorAll('.demo-btn');

  demoButtons.forEach(button => {
    button.addEventListener('click', () => {
      const intervention = button.getAttribute('data-intervention');

      if (intervention === 'notification') {
        // Show system notification
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showNotification(
            'Stay Focused!',
            'Remember to take breaks and stay hydrated.'
          );
          console.log('Triggered: System Notification');
        }
      } else if (intervention === 'breathing') {
        // Show breathing exercise directly
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showBreathingExercise(() => {
            console.log('Breathing exercise completed');
          });
        }
      } else if (interventionContent[intervention]) {
        // Show intervention modal
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showInterventionModal(
            intervention,
            interventionContent[intervention]
          );
        }
      } else {
        console.warn('Unknown intervention:', intervention);
      }
    });
  });

  console.log('[Demo] Event listeners attached to', demoButtons.length, 'buttons');
});

console.log('[Demo] Initialization complete');
