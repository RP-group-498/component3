/**
 * Focus Timer Module (Pomodoro)
 * - Pomodoro timer implementation
 * - Work/break cycle management
 * - Integration with task sessions
 * - Timer state persistence
 * - Event logging
 */

const DEFAULT_WORK_DURATION = 25; // minutes
const DEFAULT_BREAK_DURATION = 5; // minutes
const DEFAULT_LONG_BREAK_DURATION = 15; // minutes
const SESSIONS_UNTIL_LONG_BREAK = 4;

let timerState = {
  isActive: false,
  isPaused: false,
  isBreak: false,
  taskId: null,
  duration: DEFAULT_WORK_DURATION, // in minutes
  remainingTime: DEFAULT_WORK_DURATION * 60, // in seconds
  startTime: null,
  sessionsCompleted: 0,
  timerInterval: null,
  callbacks: {
    onTick: null,
    onComplete: null,
    onBreakComplete: null
  }
};

/**
 * Initialize timer module
 */
async function initTimer() {
  // Load saved timer state from MongoDB (with localStorage fallback)
  const saved = await loadTimerState();
  if (saved) {
    timerState = { ...timerState, ...saved };
    console.log('[FocusTimer] Loaded saved timer state');
  }

  // Load settings
  const workDuration = await getSetting('focus_duration', DEFAULT_WORK_DURATION);
  const breakDuration = await getSetting('break_duration', DEFAULT_BREAK_DURATION);
  const longBreakDuration = await getSetting('long_break_duration', DEFAULT_LONG_BREAK_DURATION);

  console.log('[FocusTimer] Initialized', { workDuration, breakDuration, longBreakDuration });

  return { success: true };
}

/**
 * Start a focus session for a task
 * @param {string} taskId - Task ID
 * @param {number} duration - Duration in minutes (optional)
 */
async function startFocusSession(taskId, duration = null) {
  if (!taskId) {
    console.warn('[FocusTimer] No task ID provided');
    return { success: false, error: 'No task ID' };
  }

  // Stop any existing timer
  if (timerState.isActive) {
    stopTimer();
  }

  // Get duration from settings or use provided/default
  const workDuration = duration || await getSetting('focus_duration', DEFAULT_WORK_DURATION);

  timerState = {
    ...timerState,
    isActive: true,
    isPaused: false,
    isBreak: false,
    taskId: taskId,
    duration: workDuration,
    remainingTime: workDuration * 60,
    startTime: Date.now()
  };

  startTimerInterval();
  saveTimerState();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('focus_session_started', {
      task_id: taskId,
      duration: workDuration
    });
  }

  console.log(`[FocusTimer] Started focus session for task ${taskId} (${workDuration}m)`);
  return { success: true };
}

/**
 * Start timer interval (counts down)
 */
function startTimerInterval() {
  if (timerState.timerInterval) {
    clearInterval(timerState.timerInterval);
  }

  timerState.timerInterval = setInterval(() => {
    if (!timerState.isPaused && timerState.remainingTime > 0) {
      timerState.remainingTime--;
      saveTimerState();

      // Trigger callback
      if (timerState.callbacks.onTick) {
        const minutes = Math.floor(timerState.remainingTime / 60);
        const seconds = timerState.remainingTime % 60;
        timerState.callbacks.onTick(minutes, seconds);
      }

      // Check if timer complete
      if (timerState.remainingTime === 0) {
        handleTimerComplete();
      }
    }
  }, 1000); // Every second
}

/**
 * Handle timer completion
 */
async function handleTimerComplete() {
  clearInterval(timerState.timerInterval);
  timerState.timerInterval = null;

  if (timerState.isBreak) {
    // Break completed
    timerState.isActive = false;
    timerState.isBreak = false;
    saveTimerState();

    // Log event
    if (window.EventLogger) {
      await window.EventLogger.logEvent('focus_session_break_ended', {});
    }

    // Trigger callback
    if (timerState.callbacks.onBreakComplete) {
      timerState.callbacks.onBreakComplete();
    }

    console.log('[FocusTimer] Break completed');
  } else {
    // Work session completed
    timerState.sessionsCompleted++;
    saveTimerState();

    // Log event
    if (window.EventLogger) {
      await window.EventLogger.logEvent('focus_session_ended', {
        task_id: timerState.taskId,
        actual_duration: timerState.duration
      });
    }

    // Trigger callback
    if (timerState.callbacks.onComplete) {
      timerState.callbacks.onComplete();
    }

    console.log('[FocusTimer] Focus session completed');

    // Auto-start break
    await startBreak();
  }
}

/**
 * Start break timer
 */
async function startBreak() {
  const isLongBreak = timerState.sessionsCompleted % SESSIONS_UNTIL_LONG_BREAK === 0;
  const breakDuration = isLongBreak
    ? await getSetting('long_break_duration', DEFAULT_LONG_BREAK_DURATION)
    : await getSetting('break_duration', DEFAULT_BREAK_DURATION);

  timerState = {
    ...timerState,
    isActive: true,
    isPaused: false,
    isBreak: true,
    duration: breakDuration,
    remainingTime: breakDuration * 60,
    startTime: Date.now()
  };

  startTimerInterval();
  saveTimerState();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('focus_session_break_started', {
      duration: breakDuration,
      is_long_break: isLongBreak
    });
  }

  console.log(`[FocusTimer] Started ${isLongBreak ? 'long' : 'short'} break (${breakDuration}m)`);
}

/**
 * Pause timer
 */
function pauseTimer() {
  if (!timerState.isActive || timerState.isPaused) {
    return { success: false, error: 'Timer not active or already paused' };
  }

  timerState.isPaused = true;
  saveTimerState();

  console.log('[FocusTimer] Paused');
  return { success: true };
}

/**
 * Resume timer
 */
function resumeTimer() {
  if (!timerState.isActive || !timerState.isPaused) {
    return { success: false, error: 'Timer not paused' };
  }

  timerState.isPaused = false;
  saveTimerState();

  console.log('[FocusTimer] Resumed');
  return { success: true };
}

/**
 * Stop timer (cancel session)
 */
async function stopTimer() {
  if (!timerState.isActive) {
    return { success: false, error: 'Timer not active' };
  }

  clearInterval(timerState.timerInterval);
  timerState.timerInterval = null;

  // Log if work session was stopped early
  if (!timerState.isBreak && timerState.taskId) {
    const timeSpent = timerState.duration - Math.floor(timerState.remainingTime / 60);
    console.log(`[FocusTimer] Stopped early (${timeSpent}/${timerState.duration}m)`);
  }

  timerState = {
    ...timerState,
    isActive: false,
    isPaused: false,
    isBreak: false,
    taskId: null,
    remainingTime: 0,
    startTime: null
  };

  saveTimerState();

  console.log('[FocusTimer] Stopped');
  return { success: true };
}

/**
 * Skip current break
 */
async function skipBreak() {
  if (!timerState.isBreak) {
    return { success: false, error: 'Not in break mode' };
  }

  await stopTimer();
  console.log('[FocusTimer] Skipped break');
  return { success: true };
}

/**
 * Get current timer state
 * @returns {Object} Timer state
 */
function getTimerState() {
  return {
    isActive: timerState.isActive,
    isPaused: timerState.isPaused,
    isBreak: timerState.isBreak,
    taskId: timerState.taskId,
    duration: timerState.duration,
    remainingTime: timerState.remainingTime,
    minutes: Math.floor(timerState.remainingTime / 60),
    seconds: timerState.remainingTime % 60,
    sessionsCompleted: timerState.sessionsCompleted
  };
}

/**
 * Register callback for timer tick
 * @param {Function} callback - Callback function(minutes, seconds)
 */
function onTimerTick(callback) {
  timerState.callbacks.onTick = callback;
}

/**
 * Register callback for timer complete
 * @param {Function} callback - Callback function
 */
function onTimerComplete(callback) {
  timerState.callbacks.onComplete = callback;
}

/**
 * Register callback for break complete
 * @param {Function} callback - Callback function
 */
function onBreakComplete(callback) {
  timerState.callbacks.onBreakComplete = callback;
}

/**
 * Save timer state to MongoDB (with localStorage fallback)
 */
async function saveTimerState() {
  try {
    const state = {
      isActive: timerState.isActive,
      isPaused: timerState.isPaused,
      isBreak: timerState.isBreak,
      taskId: timerState.taskId,
      duration: timerState.duration,
      remainingTime: timerState.remainingTime,
      startTime: timerState.startTime,
      sessionsCompleted: timerState.sessionsCompleted
    };

    // Save to MongoDB via API
    try {
      await fetch('http://localhost:8000/api/v1/settings/timer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (apiError) {
      console.warn('[FocusTimer] API offline, saving to localStorage only:', apiError);
    }

    // Also save to localStorage as backup
    localStorage.setItem('timerState', JSON.stringify(state));
  } catch (error) {
    console.error('[FocusTimer] Error saving timer state:', error);
  }
}

/**
 * Load timer state from MongoDB (with localStorage fallback)
 */
async function loadTimerState() {
  try {
    let state = null;

    // Try to get from API first
    try {
      const response = await fetch('http://localhost:8000/api/v1/settings/timer');
      const data = await response.json();
      if (data.success && data.timerState) {
        state = data.timerState;
      }
    } catch (apiError) {
      console.warn('[FocusTimer] API offline, loading from localStorage:', apiError);
    }

    // Fallback to localStorage if API fails
    if (!state) {
      const raw = localStorage.getItem('timerState');
      if (!raw) return null;
      state = JSON.parse(raw);
    }

    // Don't restore active timer (would be stale)
    // Only restore session count
    return {
      sessionsCompleted: state.sessionsCompleted || 0
    };
  } catch (error) {
    console.error('[FocusTimer] Error loading timer state:', error);
    return null;
  }
}

/**
 * Get setting from storage
 */
async function getSetting(key, defaultValue) {
  if (window.EventLogger && window.EventLogger.getSetting) {
    return await window.EventLogger.getSetting(key, defaultValue);
  }
  return defaultValue;
}

/**
 * Save setting to storage
 */
async function saveSetting(key, value) {
  if (window.EventLogger && window.EventLogger.saveSetting) {
    return await window.EventLogger.saveSetting(key, value);
  }
}

/**
 * Update timer settings
 * @param {Object} settings - Settings to update
 */
async function updateSettings(settings) {
  if (settings.focusDuration) {
    await saveSetting('focus_duration', settings.focusDuration);
  }
  if (settings.breakDuration) {
    await saveSetting('break_duration', settings.breakDuration);
  }
  if (settings.longBreakDuration) {
    await saveSetting('long_break_duration', settings.longBreakDuration);
  }

  console.log('[FocusTimer] Settings updated');
  return { success: true };
}

/**
 * Reset session counter
 */
function resetSessionCounter() {
  timerState.sessionsCompleted = 0;
  saveTimerState();
  console.log('[FocusTimer] Session counter reset');
}

// Export API
if (typeof window !== 'undefined') {
  window.FocusTimer = {
    initTimer,
    startFocusSession,
    pauseTimer,
    resumeTimer,
    stopTimer,
    skipBreak,
    getTimerState,
    onTimerTick,
    onTimerComplete,
    onBreakComplete,
    updateSettings,
    resetSessionCounter
  };
}
