/**
 * Task Manager Module
 * - Task CRUD operations
 * - Status state machine (pending → started → paused/completed/abandoned)
 * - Session tracking with timestamps
 * - Calculate actual time spent
 * - Integration with event logging
 */

let tasks = [];
let activeSessionInterval = null;

/**
 * Load tasks from localStorage and migrate to new data model
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem('tasks');
    const loadedTasks = raw ? JSON.parse(raw) : [];

    // Migrate tasks to new data model
    tasks = loadedTasks.map(task => migrateLegacyTask(task));

    console.log(`[TaskManager] Loaded ${tasks.length} tasks`);
    return tasks;
  } catch (error) {
    console.error('[TaskManager] Error loading tasks:', error);
    tasks = [];
    return [];
  }
}

/**
 * Migrate legacy task to new data model
 * @param {Object} task - Legacy task object
 * @returns {Object} Migrated task
 */
function migrateLegacyTask(task) {
  // Generate UUID if missing
  if (!task.id) {
    task.id = generateUUID();
  }

  // Add status field (convert done boolean to status enum)
  if (!task.status) {
    task.status = task.done ? 'completed' : 'pending';
  }

  // Add estimated duration (default: null)
  if (task.estimatedDuration === undefined) {
    task.estimatedDuration = null;
  }

  // Add actual time spent
  if (task.actualTimeSpent === undefined) {
    task.actualTimeSpent = 0;
  }

  // Add sessions array
  if (!task.sessions) {
    task.sessions = [];
  }

  // Add current session start
  if (task.currentSessionStart === undefined) {
    task.currentSessionStart = null;
  }

  // Add behavioral tracking fields (new for TMT calculations)
  if (task.retryCount === undefined) {
    task.retryCount = 0;
  }
  if (task.postponementCount === undefined) {
    task.postponementCount = 0;
  }
  if (task.hoursDelayedBeforeStarting === undefined) {
    task.hoursDelayedBeforeStarting = 0;
  }
  if (task.firstStartTime === undefined) {
    task.firstStartTime = null;
  }
  if (task.appBackgroundEvents === undefined) {
    task.appBackgroundEvents = 0;
  }
  if (task.dismissedReminders === undefined) {
    task.dismissedReminders = 0;
  }
  if (task.totalReminders === undefined) {
    task.totalReminders = 0;
  }

  // TMT values - keep if exist (from old manual input), otherwise set defaults
  if (task.expectancy === undefined) {
    task.expectancy = 5;
  }
  if (task.value === undefined) {
    task.value = 5;
  }
  if (task.impulsivity === undefined) {
    task.impulsivity = 5;
  }
  if (task.delay === undefined) {
    task.delay = 5;
  }

  return task;
}

/**
 * Recalculate TMT values for a task based on behavioral data
 * @param {string} taskId - Task ID
 */
function recalculateTMT(taskId) {
  if (!window.TMTEngine) return;

  const task = getTaskById(taskId);
  if (!task) return;

  const tmt = window.TMTEngine.calculateTMT(task, tasks);

  task.expectancy = tmt.expectancy;
  task.value = tmt.value;
  task.impulsivity = tmt.impulsiveness;
  task.delay = tmt.delay;

  return task;
}

/**
 * Save tasks to localStorage
 */
function saveTasks() {
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));

    // Notify main process for notifications
    if (typeof ipcRenderer !== 'undefined') {
      try {
        ipcRenderer.send('notify:tasks', tasks);
      } catch (e) {
        // IPC not available (in browser mode)
      }
    }

    // Auto-save active session state for crash recovery
    saveActiveSessionState();

    return { success: true };
  } catch (error) {
    console.error('[TaskManager] Error saving tasks:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save active session state for crash recovery
 */
function saveActiveSessionState() {
  const activeTask = getActiveTask();
  if (activeTask && activeTask.currentSessionStart) {
    localStorage.setItem('activeSession', JSON.stringify({
      taskId: activeTask.id,
      startTime: activeTask.currentSessionStart,
      lastSave: Date.now()
    }));
  } else {
    localStorage.removeItem('activeSession');
  }
}

/**
 * Check for crashed session on app start
 * @returns {Object|null} Crashed session data or null
 */
function checkForCrashedSession() {
  try {
    const raw = localStorage.getItem('activeSession');
    if (!raw) return null;

    const session = JSON.parse(raw);
    const task = getTaskById(session.taskId);

    if (task && task.status === 'started' && task.currentSessionStart) {
      // This is a crashed session
      return {
        task,
        startTime: session.startTime,
        lastSave: session.lastSave,
        estimatedDuration: Math.floor((session.lastSave - session.startTime) / 1000 / 60)
      };
    }

    return null;
  } catch (error) {
    console.error('[TaskManager] Error checking for crashed session:', error);
    return null;
  }
}

/**
 * Recover crashed session
 * @param {string} taskId - Task ID to recover
 */
async function recoverCrashedSession(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;

  try {
    const raw = localStorage.getItem('activeSession');
    if (!raw) return;

    const session = JSON.parse(raw);

    // Calculate duration up to last save
    const duration = Math.floor((session.lastSave - session.startTime) / 1000 / 60);

    // Close the crashed session
    if (task.currentSessionStart) {
      task.sessions.push({
        startTime: session.startTime,
        endTime: session.lastSave,
        duration: duration
      });
      task.actualTimeSpent += duration;
      task.currentSessionStart = null;
    }

    // Update status to paused
    task.status = 'paused';

    saveTasks();

    // Log recovery event
    if (window.EventLogger) {
      await window.EventLogger.logEvent('session_recovered', {
        task_id: task.id,
        duration: duration
      });
    }

    localStorage.removeItem('activeSession');
    console.log('[TaskManager] Recovered crashed session for task:', task.id);
  } catch (error) {
    console.error('[TaskManager] Error recovering crashed session:', error);
  }
}

/**
 * Create a new task
 * @param {Object} taskData - Task data
 * @returns {Object} Created task
 */
async function createTask(taskData) {
  // Get default TMT values from engine
  const defaultTMT = window.TMTEngine
    ? window.TMTEngine.getDefaultTMT(tasks)
    : { expectancy: 5, value: 5, impulsiveness: 5, delay: 5 };

  const task = {
    id: generateUUID(),
    text: taskData.text,
    deadlineDate: taskData.deadlineDate || null,
    deadlineTime: taskData.deadlineTime || null,
    category: taskData.category || 'personal',
    estimatedDuration: taskData.estimatedDuration || null,

    // TMT values (calculated, not user input)
    expectancy: defaultTMT.expectancy,
    value: defaultTMT.value,
    impulsivity: defaultTMT.impulsiveness,
    delay: defaultTMT.delay,

    // Status tracking
    status: 'pending',
    actualTimeSpent: 0,
    sessions: [],
    currentSessionStart: null,
    done: false,
    created: Date.now(),
    lastNotified: null,

    // Behavioral tracking fields for TMT calculations
    retryCount: 0,
    postponementCount: 0,
    hoursDelayedBeforeStarting: 0,
    firstStartTime: null,
    appBackgroundEvents: 0,
    dismissedReminders: 0,
    totalReminders: 0
  };

  // Calculate initial delay from deadline
  if (window.TMTEngine) {
    const tmt = window.TMTEngine.calculateTMT(task, tasks);
    task.delay = tmt.delay;
  }

  tasks.unshift(task);
  saveTasks();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('task_created', {
      task_id: task.id,
      category: task.category,
      estimated_duration: task.estimatedDuration
    });
  }

  console.log('[TaskManager] Created task:', task.id);
  return task;
}

/**
 * Update a task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 */
async function updateTask(taskId, updates) {
  const task = getTaskById(taskId);
  if (!task) {
    console.warn('[TaskManager] Task not found:', taskId);
    return null;
  }

  // Apply updates
  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'created') {
      task[key] = updates[key];
    }
  });

  saveTasks();

  console.log('[TaskManager] Updated task:', taskId);
  return task;
}

/**
 * Delete a task
 * @param {string} taskId - Task ID
 */
async function deleteTask(taskId) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    console.warn('[TaskManager] Task not found:', taskId);
    return false;
  }

  const task = tasks[taskIndex];

  // If task is active, stop the session first
  if (task.status === 'started' && task.currentSessionStart) {
    await pauseTask(taskId);
  }

  tasks.splice(taskIndex, 1);
  saveTasks();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('task_deleted', {
      task_id: taskId
    });
  }

  console.log('[TaskManager] Deleted task:', taskId);
  return true;
}

/**
 * Start a task (begin session)
 * @param {string} taskId - Task ID
 */
async function startTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return null;

  // Pause any other active task first
  const activeTask = getActiveTask();
  if (activeTask && activeTask.id !== taskId) {
    await pauseTask(activeTask.id);
  }

  // Start new session
  task.status = 'started';
  task.currentSessionStart = Date.now();
  task.done = false;

  // Update behavioral data for TMT calculations
  if (window.TMTEngine) {
    window.TMTEngine.updateBehavioralData(task, 'task_started');
  }

  // Recalculate TMT values
  recalculateTMT(taskId);

  saveTasks();

  // Start auto-save interval (every 60 seconds)
  startAutoSaveInterval();

  // Log event
  const eventType = task.sessions.length > 0 ? 'task_resumed' : 'task_started';
  if (window.EventLogger) {
    await window.EventLogger.logEvent(eventType, {
      task_id: task.id
    });
  }

  console.log('[TaskManager] Started task:', taskId);
  return task;
}

/**
 * Pause a task (end current session)
 * @param {string} taskId - Task ID
 */
async function pauseTask(taskId) {
  const task = getTaskById(taskId);
  if (!task || task.status !== 'started' || !task.currentSessionStart) {
    return null;
  }

  const now = Date.now();
  const sessionDuration = Math.floor((now - task.currentSessionStart) / 1000 / 60);

  // Save session
  task.sessions.push({
    startTime: task.currentSessionStart,
    endTime: now,
    duration: sessionDuration
  });

  task.actualTimeSpent += sessionDuration;
  task.currentSessionStart = null;
  task.status = 'paused';

  // Update behavioral data for TMT calculations
  if (window.TMTEngine) {
    window.TMTEngine.updateBehavioralData(task, 'task_paused');
  }

  // Recalculate TMT values
  recalculateTMT(taskId);

  saveTasks();

  // Stop auto-save interval if no other active tasks
  if (!getActiveTask()) {
    stopAutoSaveInterval();
  }

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('task_paused', {
      task_id: task.id,
      session_duration: sessionDuration
    });
  }

  console.log('[TaskManager] Paused task:', taskId, `(${sessionDuration}m)`);
  return task;
}

/**
 * Complete a task
 * @param {string} taskId - Task ID
 */
async function completeTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return null;

  // If task is active, pause it first
  if (task.status === 'started' && task.currentSessionStart) {
    await pauseTask(taskId);
  }

  task.status = 'completed';
  task.done = true;

  saveTasks();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('task_completed', {
      task_id: task.id,
      total_duration: task.actualTimeSpent,
      estimated_duration: task.estimatedDuration
    });
  }

  console.log('[TaskManager] Completed task:', taskId);
  return task;
}

/**
 * Mark a task as abandoned
 * @param {string} taskId - Task ID
 */
async function abandonTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return null;

  // If task is active, pause it first
  if (task.status === 'started' && task.currentSessionStart) {
    await pauseTask(taskId);
  }

  task.status = 'abandoned';

  saveTasks();

  // Log event
  if (window.EventLogger) {
    await window.EventLogger.logEvent('task_abandoned', {
      task_id: task.id
    });
  }

  console.log('[TaskManager] Abandoned task:', taskId);
  return task;
}

/**
 * Toggle task completion (for checkbox)
 * @param {number} index - Task index
 */
async function toggleDone(index) {
  const task = tasks[index];
  if (!task) return;

  if (task.done) {
    // Uncomplete task
    task.done = false;
    task.status = task.sessions.length > 0 ? 'paused' : 'pending';
    saveTasks();
  } else {
    // Complete task
    await completeTask(task.id);
  }

  return task;
}

/**
 * Get task by ID
 * @param {string} taskId - Task ID
 * @returns {Object|null} Task or null
 */
function getTaskById(taskId) {
  return tasks.find(t => t.id === taskId) || null;
}

/**
 * Get currently active task
 * @returns {Object|null} Active task or null
 */
function getActiveTask() {
  return tasks.find(t => t.status === 'started' && t.currentSessionStart !== null) || null;
}

/**
 * Get all tasks
 * @returns {Array} Array of tasks
 */
function getAllTasks() {
  return tasks;
}

/**
 * Get tasks by status
 * @param {string} status - Task status
 * @returns {Array} Filtered tasks
 */
function getTasksByStatus(status) {
  return tasks.filter(t => t.status === status);
}

/**
 * Calculate current session duration for active task
 * @param {string} taskId - Task ID
 * @returns {number} Current session duration in minutes
 */
function getCurrentSessionDuration(taskId) {
  const task = getTaskById(taskId);
  if (!task || task.status !== 'started' || !task.currentSessionStart) {
    return 0;
  }

  const now = Date.now();
  return Math.floor((now - task.currentSessionStart) / 1000 / 60);
}

/**
 * Get total time spent including current session
 * @param {string} taskId - Task ID
 * @returns {number} Total time in minutes
 */
function getTotalTimeSpent(taskId) {
  const task = getTaskById(taskId);
  if (!task) return 0;

  let total = task.actualTimeSpent || 0;

  // Add current session if active
  if (task.status === 'started' && task.currentSessionStart) {
    total += getCurrentSessionDuration(taskId);
  }

  return total;
}

/**
 * Start auto-save interval for crash recovery
 */
function startAutoSaveInterval() {
  if (activeSessionInterval) return;

  activeSessionInterval = setInterval(() => {
    saveActiveSessionState();
  }, 60000); // Every 60 seconds
}

/**
 * Stop auto-save interval
 */
function stopAutoSaveInterval() {
  if (activeSessionInterval) {
    clearInterval(activeSessionInterval);
    activeSessionInterval = null;
  }
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Export API
if (typeof window !== 'undefined') {
  window.TaskManager = {
    loadTasks,
    saveTasks,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    completeTask,
    abandonTask,
    toggleDone,
    getTaskById,
    getActiveTask,
    getAllTasks,
    getTasksByStatus,
    getCurrentSessionDuration,
    getTotalTimeSpent,
    checkForCrashedSession,
    recoverCrashedSession,
    recalculateTMT
  };
}
