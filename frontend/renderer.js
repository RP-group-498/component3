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
  '5_second_rule': {
    title: 'Use the 5-Second Rule',
    body: 'Count down 5-4-3-2-1 and then GO. Do not give your brain time to hesitate!',
    onAccept: () => {
      console.log('User accepted: 5-Second Rule');
      logToBackend('5_second_rule', 'accept');
    },
    onReject: () => {
      console.log('User rejected: 5-Second Rule');
      logToBackend('5_second_rule', 'reject');
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

  // Listen for notification actions from main process
  if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('notification-action-response', (event, { strategy, action }) => {
      console.log(`[Notification Action] ${strategy}: ${action}`);
      logToBackend(strategy, action);

      if (strategy === 'pomodoro' && action === 'start') {
        startPomodoroTimer();
      } else if (strategy === '5_second_rule' && action === 'start') {
        startFiveSecondCountdown();
      } else if (strategy === 'breathing' && action === 'start') {
        ipcRenderer.send('window:show');
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showBreathingExercise(() => {
            console.log('Breathing exercise completed');
          });
        }
      } else if (strategy === 'visualization' && action === 'start') {
        ipcRenderer.send('window:show');
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showVisualizationExercise(() => {
            console.log('Visualization exercise completed');
          });
        }
      } else if (strategy === 'reframe' && action === 'start') {
        ipcRenderer.send('window:show');
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showInterventionModal(
            'reframe',
            interventionContent['reframe']
          );
        }
      }
    });
  }

  function startFiveSecondCountdown() {
    console.log('5-Second Rule Started');
    let timeLeft = 5;
    const { ipcRenderer } = require('electron');

    const updateTray = () => {
      ipcRenderer.send('tray:update-timer', { label: `Go in ${timeLeft}...` });
    };

    updateTray();

    const timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        updateTray();
      } else {
        clearInterval(timerInterval);
        ipcRenderer.send('tray:update-timer', { label: 'Let\'s Go!' });
        
        // Show completion notification
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showNotification(
            'Time to Move!',
            '5-4-3-2-1... GO!'
          );
        }

        // Clear tray after 3 seconds
        setTimeout(() => {
          ipcRenderer.send('tray:clear');
        }, 3000);
      }
    }, 1000);
  }

  function startPomodoroTimer() {
    console.log('Pomodoro Timer Started: 25 minutes');
    let timeLeft = 25 * 60; // 25 minutes in seconds
    const { ipcRenderer } = require('electron');

    const updateTray = () => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ipcRenderer.send('tray:update-timer', { label });
    };

    updateTray();

    const timerInterval = setInterval(() => {
      timeLeft--;
      updateTray();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        ipcRenderer.send('tray:clear');
        
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showNotification(
            'Pomodoro Complete!',
            'Great work! Now take a 5-minute break.'
          );
        }
        startBreakTimer();
      }
    }, 1000);
  }

  function startBreakTimer() {
    let timeLeft = 5 * 60; // 5 minutes in seconds
    const { ipcRenderer } = require('electron');

    const updateTray = () => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const label = `Break: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      ipcRenderer.send('tray:update-timer', { label });
    };

    updateTray();

    const breakInterval = setInterval(() => {
      timeLeft--;
      updateTray();

      if (timeLeft <= 0) {
        clearInterval(breakInterval);
        ipcRenderer.send('tray:clear');
        
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showNotification(
            'Break Over',
            'Ready to start your next session?'
          );
        }
      }
    }, 1000);
  }

  demoButtons.forEach(button => {
    button.addEventListener('click', () => {
      const intervention = button.getAttribute('data-intervention');

      if (intervention === 'pomodoro') {
        // Trigger OS Notification with actions instead of modal
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: 'Pomodoro Session',
            body: 'Ready to focus for 25 minutes?',
            strategy: 'pomodoro'
          });
        }
      } else if (intervention === '5_second_rule') {
        // Trigger OS Notification with actions for 5-second rule
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: '5-Second Rule',
            body: 'Count down 5-4-3-2-1 and move!',
            strategy: '5_second_rule'
          });
        }
      } else if (intervention === 'breathing') {
        // Trigger OS Notification with actions for breathing
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: 'Time for a Breath',
            body: 'Take a moment to calm your mind.',
            strategy: 'breathing'
          });
        }
      } else if (intervention === 'visualization') {
        // Trigger OS Notification with actions for visualization
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: 'Visualize Completion',
            body: 'Close your eyes and imagine finishing this task.',
            strategy: 'visualization'
          });
        }
      } else if (intervention === 'reframe') {
        // Trigger OS Notification with actions for reframe
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: 'Reframe Your Perspective',
            body: 'Try looking at this task from a different angle.',
            strategy: 'reframe'
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
