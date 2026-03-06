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

// ─── Bandit integration ──────────────────────────────────────────────────────

const BANDIT_USER_ID = 'u123';
const API_BASE = 'http://localhost:8000';

// Maps bandit action IDs (backend) → strategy IDs (frontend notification system)
const ACTION_TO_STRATEGY = {
  FIVE_SECOND_RULE: '5_second_rule',
  POMODORO:         'pomodoro',
  BREATHING:        'breathing',
  VISUALIZATION:    'visualization',
  REFRAME:          'reframe',
};

// Notification content for each bandit action
const ACTION_NOTIFICATIONS = {
  FIVE_SECOND_RULE: { title: '5-Second Rule',        body: 'Count down 5-4-3-2-1 and move!' },
  POMODORO:         { title: 'Pomodoro Session',      body: 'Ready to focus for 25 minutes?' },
  BREATHING:        { title: 'Time for a Breath',     body: 'Take a moment to calm your mind.' },
  VISUALIZATION:    { title: 'Visualize Completion',  body: 'Close your eyes and imagine finishing this task.' },
  REFRAME:          { title: 'Reframe Your Perspective', body: null }, // body built from life goal at runtime
};

// Holds the bandit suggestion that is waiting for a user response.
// Set before the notification fires, cleared after /bandit/update is sent.
let _pendingBandit = null; // { action: string, vector: number[] } | null

/**
 * Get the context vector for the current mock scenario.
 * @returns {number[]}
 */
function getContextVector() {
  return MockContext.getMockContext(BANDIT_USER_ID);
}

/**
 * Call POST /bandit/select and return the chosen action string.
 * @param {number[]} vector
 * @returns {Promise<{ action: string, allowed_actions: string[] }>}
 */
async function selectIntervention(vector) {
  const res = await fetch(`${API_BASE}/bandit/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: BANDIT_USER_ID, x: vector, alpha: 1.0 }),
  });
  if (!res.ok) throw new Error(`/bandit/select failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Map a notification button label to a numeric reward.
 * @param {string} button  'start' | 'skip' | 'not_now' | 'reject'
 * @returns {number}
 */
function computeReward(button) {
  if (button === 'start')                    return 1.0;
  if (button === 'not_now' || button === 'reject') return 0.4;
  return 0.2; // skip
}

/**
 * Call POST /bandit/update to record the user's response and update the model.
 * @param {string}   action  bandit action ID (e.g. 'POMODORO')
 * @param {number[]} vector  the context vector used when selecting
 * @param {number}   reward
 * @param {string}   button  raw button value from the notification
 */
async function sendBanditUpdate(action, vector, reward, button) {
  try {
    const res = await fetch(`${API_BASE}/bandit/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: BANDIT_USER_ID,
        x: vector,
        action,
        reward,
        button,
        alpha: 1.0,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Bandit] Updated — action=${action} reward=${reward} n_updates=${data.n_updates}`);
    } else {
      console.warn('[Bandit] Update failed:', res.statusText);
    }
  } catch (err) {
    console.error('[Bandit] Update error:', err);
  }
}

/**
 * Fire the OS notification for a bandit-chosen action.
 * Stores the pending bandit state before sending so the response handler
 * can call sendBanditUpdate when the user responds.
 * @param {string}   action  bandit action ID
 * @param {number[]} vector  context vector
 */
async function triggerBanditNotification(action, vector) {
  const strategy = ACTION_TO_STRATEGY[action];
  let { title, body } = ACTION_NOTIFICATIONS[action];

  if (action === 'REFRAME') {
    let goal = 'your goals';
    try {
      const res = await fetch(`${API_BASE}/user/goal`);
      const data = await res.json();
      if (data.life_goal) goal = data.life_goal;
    } catch (e) {
      console.warn('[Bandit] Could not fetch life goal for reframe:', e);
    }
    body = `I choose to do this because it helps me ${goal}.`;
  }

  // Record pending state BEFORE sending notification so the IPC response
  // handler can find it immediately.
  _pendingBandit = { action, vector };

  if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('notify:intervention-actions', { title, body, strategy });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Motivation chart ────────────────────────────────────────────────────────

const SCENARIO_POINT_COLORS = {
  A: '#4ade80',  // green  — low urgency
  B: '#fb923c',  // orange — high urgency
  C: '#f87171',  // red    — overdue
};

let _motivationChart = null;
let _currentFilterSeconds = 3600; // default: last 1 hour

/**
 * POST a motivation snapshot to the backend. Fire-and-forget.
 * @param {number[]} vector  context vector (motivation = vector[6])
 * @param {string}   scenario  'A' | 'B' | 'C'
 */
async function logMotivation(vector, scenario) {
  try {
    await fetch(`${API_BASE}/motivation/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:    BANDIT_USER_ID,
        motivation: vector[6],
        scenario,
      }),
    });
  } catch (e) {
    console.warn('[Motivation] Log failed:', e);
  }
}

/**
 * Fetch motivation history from the backend.
 * @param {number} sinceSeconds  how many seconds back to look
 * @returns {Promise<Array<{ motivation: number, scenario: string, timestamp: number }>>}
 */
async function fetchMotivationHistory(sinceSeconds) {
  const res = await fetch(
    `${API_BASE}/motivation/history?user_id=${BANDIT_USER_ID}&since=${sinceSeconds}`
  );
  if (!res.ok) throw new Error(`/motivation/history failed: ${res.statusText}`);
  return res.json();
}

/**
 * Format a unix timestamp for the X-axis label.
 * Short windows → HH:MM, long windows → "MMM D HH:MM".
 * @param {number} ts  unix timestamp (seconds)
 * @param {number} sinceSeconds
 * @returns {string}
 */
function _formatTick(ts, sinceSeconds) {
  const d = new Date(ts * 1000);
  if (sinceSeconds <= 21600) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Create or update the Chart.js motivation chart.
 * @param {Array}  data          array of { motivation, scenario, timestamp }
 * @param {number} sinceSeconds  active filter window (for tick formatting)
 */
function renderMotivationChart(data, sinceSeconds) {
  const canvas   = document.getElementById('motivationChart');
  const emptyMsg = document.getElementById('motivationEmpty');
  if (!canvas || !emptyMsg) return;

  if (data.length === 0) {
    if (_motivationChart) { _motivationChart.destroy(); _motivationChart = null; }
    canvas.style.display   = 'none';
    emptyMsg.style.display = 'flex';
    return;
  }

  canvas.style.display   = 'block';
  emptyMsg.style.display = 'none';

  const labels      = data.map(d => _formatTick(d.timestamp, sinceSeconds));
  const values      = data.map(d => d.motivation);
  const pointColors = data.map(d => SCENARIO_POINT_COLORS[d.scenario] || '#667eea');
  const tooltipData = data; // kept in closure for tooltip callback

  if (_motivationChart) {
    _motivationChart.data.labels                                  = labels;
    _motivationChart.data.datasets[0].data                        = values;
    _motivationChart.data.datasets[0].pointBackgroundColor        = pointColors;
    _motivationChart.data.datasets[0].pointBorderColor            = pointColors;
    _motivationChart.options.plugins.tooltip.callbacks.label      = (ctx) => {
      const d = tooltipData[ctx.dataIndex];
      return `Motivation: ${d.motivation.toFixed(3)}   Scenario ${d.scenario}`;
    };
    _motivationChart.update();
    return;
  }

  _motivationChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Motivation',
        data: values,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.07)',
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = tooltipData[ctx.dataIndex];
              return `Motivation: ${d.motivation.toFixed(3)}   Scenario ${d.scenario}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: '#9ca3af', font: { size: 11 }, maxTicksLimit: 8 },
        },
        y: {
          min: 0,
          max: 1,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#9ca3af',
            font: { size: 11 },
            stepSize: 0.25,
            callback: (v) => v.toFixed(2),
          },
        },
      },
    },
  });
}

/**
 * Fetch latest data and repaint the chart using the current filter.
 */
async function refreshMotivationChart() {
  try {
    const data = await fetchMotivationHistory(_currentFilterSeconds);
    renderMotivationChart(data, _currentFilterSeconds);
  } catch (e) {
    console.warn('[Motivation] Chart refresh failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const lifeGoalInput = document.getElementById('lifeGoalInput');
  const saveGoalBtn = document.getElementById('saveGoalBtn');

  // Load existing goal
  fetch('http://localhost:8000/user/goal')
    .then(res => res.json())
    .then(data => {
      if (data.life_goal) lifeGoalInput.value = data.life_goal;
    });

  saveGoalBtn.addEventListener('click', async () => {
    const goal = lifeGoalInput.value;
    try {
      await fetch('http://localhost:8000/user/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ life_goal: goal })
      });
      console.log('Goal saved successfully');
      alert('Goal saved!');
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  });

  // Listen for notification actions from main process
  if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('notification-action-response', async (event, { strategy, action }) => {
      console.log(`[Notification Action] ${strategy}: ${action}`);

      // Map 'reject' to 'not_now' for logging if needed
      const logAction = action === 'reject' ? 'not_now' : action;
      logToBackend(strategy, logAction);

      // If this response is for a pending bandit suggestion, update the model
      if (_pendingBandit && ACTION_TO_STRATEGY[_pendingBandit.action] === strategy) {
        const reward = computeReward(logAction);
        await sendBanditUpdate(_pendingBandit.action, _pendingBandit.vector, reward, logAction);
        _pendingBandit = null;
        refreshMotivationChart();
      }

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
        // No modal needed, the message was in the notification body
        console.log('User acknowledged reframe notification');
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
    button.addEventListener('click', async () => {
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
        // Fetch current goal for reframe notification body
        let goal = 'your goals';
        try {
          const res = await fetch('http://localhost:8000/user/goal');
          const data = await res.json();
          if (data.life_goal) goal = data.life_goal;
        } catch (e) {
          console.error('Error fetching goal for notification:', e);
        }

        // Trigger OS Notification with the reframe message directly in the body
        if (typeof require !== 'undefined') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('notify:intervention-actions', {
            title: 'Reframe Your Perspective',
            body: `I choose to do this because it helps me ${goal}.`,
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

  // --- Scenario selector ---
  const scenarioSelect = document.getElementById('scenarioSelect');
  const scenarioDescription = document.getElementById('scenarioDescription');

  if (scenarioSelect && typeof MockContext !== 'undefined') {
    // Sync dropdown to current scenario on load
    scenarioSelect.value = MockContext.getCurrentScenario();

    scenarioSelect.addEventListener('change', async () => {
      MockContext.setScenario(scenarioSelect.value);
      scenarioDescription.textContent = MockContext.getScenarioInfo().description;
      const vector = getContextVector();
      await logMotivation(vector, MockContext.getCurrentScenario());
      refreshMotivationChart();
    });
  }

  // --- Suggest Best Intervention button ---
  const suggestBtn = document.getElementById('suggestBtn');
  const suggestStatus = document.getElementById('suggestStatus');

  if (suggestBtn && typeof MockContext !== 'undefined') {
    suggestBtn.addEventListener('click', async () => {
      suggestBtn.disabled = true;
      suggestStatus.textContent = 'Asking the model...';

      try {
        const vector = getContextVector();
        const scenario = MockContext.getCurrentScenario();

        const { action, allowed_actions } = await selectIntervention(vector);

        console.log(`[Bandit] Scenario=${scenario} allowed=${allowed_actions} selected=${action}`);
        suggestStatus.textContent =
          `[${scenario}] Model chose: ${action} (from ${allowed_actions.join(', ')})`;

        await triggerBanditNotification(action, vector);
      } catch (err) {
        console.error('[Bandit] Suggestion failed:', err);
        suggestStatus.textContent = `Error: ${err.message}`;
      } finally {
        suggestBtn.disabled = false;
      }
    });
  }

  // --- Time filter buttons ---
  const filterBtns = document.querySelectorAll('.time-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentFilterSeconds = Number(btn.dataset.seconds);
      refreshMotivationChart();
    });
  });

  // --- Initial motivation log + chart render ---
  const initVector = getContextVector();
  logMotivation(initVector, MockContext.getCurrentScenario()).then(() => {
    refreshMotivationChart();
  });

  console.log('[Demo] Event listeners attached to', demoButtons.length, 'buttons');
});

console.log('[Demo] Initialization complete');
