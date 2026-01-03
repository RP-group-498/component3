/**
 * Task Manager Module
 * - Task CRUD operations
 * - Status state machine (pending → started → paused/completed/abandoned)
 * - Session tracking with timestamps
 * - Calculate actual time spent
 * - Integration with event logging
 * - Backend API Integration
 */

const API_URL = 'http://localhost:8000/api/v1/tasks';
let tasks = [];
let activeSessionInterval = null;

/**
 * Sync dirty (offline) tasks to backend
 */
async function syncTasks() {
  const dirtyTasks = tasks.filter(t => t._dirty);
  if (dirtyTasks.length === 0) return;

  console.log(`[TaskManager] Syncing ${dirtyTasks.length} dirty tasks...`);
  
  for (const task of dirtyTasks) {
    try {
      // If task looks like it was created offline (has a generated ID but maybe not valid on server if UUIDs collide, 
      // but we use UUIDs so collision is rare).
      // We need to know if it's a CREATE or UPDATE. 
      // A simple heuristic: check if we can GET it. 
      // Or better: try PUT, if 404 then POST. 
      // But FastAPI might not support PUT on non-existent ID.
      
      // Let's assume if it has _dirty it needs saving.
      // We can try to UPDATE first.
      
      const updateResponse = await fetch(`${API_URL}/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...task, _dirty: undefined }) // Send all fields, remove _dirty
      });
      
      if (updateResponse.ok) {
        delete task._dirty;
        continue;
      }
      
      if (updateResponse.status === 404) {
        // Task doesn't exist on server, so CREATE it
        // We need to match the create payload structure
        // But the task object here is full.
        // We might need a special "upsert" or just POST with ID if backend supports it.
        // Backend `create_task` usually generates ID.
        // If we want to preserve the offline ID, we need to modify backend or use PUT as upsert if supported.
        // Checking backend... backend POST generates new ID.
        // So if we POST, we get a NEW ID. We must update local ID.
        
        // Actually, for simplicity in this turn, let's just try POSTing as a new task 
        // if PUT fails, but that duplicates data if we aren't careful.
        
        // BETTER STRATEGY: 
        // The backend `create_task` endpoint takes `TaskCreate`.
        // If we want to sync an offline task, we should use the same `TaskCreate` payload.
        
        const payload = {
           text: task.text,
           deadlineDate: task.deadlineDate,
           deadlineTime: task.deadlineTime,
           category: task.category
        };
        
        const createResponse = await fetch(`${API_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (createResponse.ok) {
             const data = await createResponse.json();
             // We got a new ID. We must swap the local ID with the new one
             // and update all references (subtasks, etc would need care, but let's assume simple task first)
             const oldId = task.id;
             const newId = data.task.id;
             
             // Update in place
             Object.assign(task, data.task);
             delete task._dirty;
             
             console.log(`[TaskManager] Synced offline task. ID changed ${oldId} -> ${newId}`);
        }
      }
    } catch (e) {
      console.warn('[TaskManager] Sync failed for task:', task.id, e);
    }
  }
  saveTasks();
}

/**
 * Load tasks from Backend API (with localStorage fallback)
 */
async function loadTasks() {
  // 1. Initialize from localStorage if memory is empty
  if (tasks.length === 0) {
      const raw = localStorage.getItem('tasks');
      if (raw) {
          try {
            const loadedTasks = JSON.parse(raw);
            tasks = loadedTasks.map(task => migrateLegacyTask(task));
            console.log(`[TaskManager] Initialized ${tasks.length} tasks from local cache`);
          } catch(e) {
            console.warn('[TaskManager] Failed to parse local tasks', e);
          }
      }
  }

  // 2. Try to sync offline changes (if any exist locally)
  if (tasks.length > 0) {
      await syncTasks();
  }

  // 3. Fetch latest state from Backend
  try {
    const response = await fetch(`${API_URL}/`);
    if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    if (data.success) {
      tasks = data.tasks;
      console.log(`[TaskManager] Loaded ${tasks.length} tasks from API`);
      
      // Update local cache
      localStorage.setItem('tasks', JSON.stringify(tasks));
      return tasks;
    }
  } catch (error) {
    console.warn('[TaskManager] API offline, loading from localStorage:', error);
    // We already loaded from localStorage in step 1, so just return what we have
    return tasks;
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

  // Add subtasks array
  if (!task.subtasks) {
    task.subtasks = [];
  }

  // Estimated duration is now calculated from subtasks (keep old value for migration)
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

  // Add activity log for detailed tracking of what user was doing
  if (!task.activityLog) {
    task.activityLog = [];
  }

  // Add intervention history for ML tracking
  if (!task.interventionHistory) {
    task.interventionHistory = [];
  }

  // Add TMT history for drop detection
  if (!task.tmtHistory) {
    task.tmtHistory = [];
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

  // Store previous TMT state for drop detection
  const oldTMT = task.tmtHistory && task.tmtHistory.length > 0
    ? task.tmtHistory[task.tmtHistory.length - 1]
    : null;

  // Update task values
  task.expectancy = tmt.expectancy;
  task.value = tmt.value;
  task.impulsivity = tmt.impulsiveness;
  task.delay = tmt.delay;

  // Store new TMT state in history (limit to last 50 entries)
  if (!task.tmtHistory) task.tmtHistory = [];
  task.tmtHistory.push({
    timestamp: Date.now(),
    ...tmt.raw,
    motivation: tmt.motivation
  });
  if (task.tmtHistory.length > 50) task.tmtHistory.shift();

  // Check for drops and trigger interventions
  if (window.InterventionManager && oldTMT) {
    window.InterventionManager.analyzeDrop(task, oldTMT, {
      motivation: tmt.motivation,
      raw: tmt.raw
    });
  }
  
  // Sync TMT updates to backend (fire and forget)
  updateTask(taskId, {
      expectancy: task.expectancy,
      value: task.value,
      impulsivity: task.impulsivity,
      delay: task.delay,
      tmtHistory: task.tmtHistory
  });

  return task;
}

/**
 * Save tasks to localStorage (Backup only)
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

    // Sync with backend
    await updateTask(task.id, {
        sessions: task.sessions,
        actualTimeSpent: task.actualTimeSpent,
        currentSessionStart: null,
        status: 'paused'
    });
    
    saveTasks(); // Local backup

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

  // Prepare payload
  const newTask = {
      text: taskData.text,
      deadlineDate: taskData.deadlineDate || null,
      deadlineTime: taskData.deadlineTime || null,
      category: taskData.category || 'personal'
  };

  try {
      const response = await fetch(`${API_URL}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
      });
      
      const data = await response.json();
      if (data.success && data.task) {
          const task = data.task;
          
          // Calculate initial delay
          if (window.TMTEngine) {
            const tmt = window.TMTEngine.calculateTMT(task, tasks);
            task.delay = tmt.delay;
            // Note: we'd need to update backend with this calculated delay, 
            // but for now let's just update local
          }
          
          tasks.unshift(task);
          saveTasks(); // Local backup
          
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
  } catch (e) {
      console.warn('[TaskManager] Create failed (offline mode):', e.message);
      
      // Fallback: Create locally
      const offlineTask = {
        id: generateUUID(),
        ...newTask,
        status: 'pending',
        created_at: new Date().toISOString(),
        _dirty: true // Mark as needing sync
      };
      
      // Populate defaults
      const task = migrateLegacyTask(offlineTask);
      
      // Set TMT defaults
      task.expectancy = defaultTMT.expectancy;
      task.value = defaultTMT.value;
      task.impulsivity = defaultTMT.impulsiveness;
      task.delay = defaultTMT.delay;
      
      tasks.unshift(task);
      saveTasks();
      
      if (window.EventLogger) {
         try {
            await window.EventLogger.logEvent('task_created', {
                task_id: task.id,
                category: task.category,
                estimated_duration: task.estimatedDuration
            });
         } catch(err) { console.warn('Event log failed', err); }
      }
      
      return task;
  }
  return null;
}

/**
 * Update a task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 */
async function updateTask(taskId, updates) {
  const task = getTaskById(taskId);
  if (!task) return null;

  try {
      const response = await fetch(`${API_URL}/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      if (data.success && data.task) {
           // Update local cache with returned task
           const index = tasks.findIndex(t => t.id === taskId);
           if (index !== -1) {
               tasks[index] = data.task;
           }
           saveTasks();
           return data.task;
      }
  } catch (e) {
       console.warn('[TaskManager] Update failed (offline mode):', e);
       // Optimistic update locally
       Object.assign(task, updates);
       task._dirty = true; // Mark as needing sync
       saveTasks();
       return task;
  }
  return null;
}

/**
 * Delete a task
 * @param {string} taskId - Task ID
 */
async function deleteTask(taskId) {
  try {
      const response = await fetch(`${API_URL}/${taskId}`, {
          method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) {
              tasks.splice(index, 1);
              saveTasks();
          }
           // Log event
            if (window.EventLogger) {
                await window.EventLogger.logEvent('task_deleted', {
                task_id: taskId
                });
            }
          console.log('[TaskManager] Deleted task:', taskId);
          return true;
      }
  } catch (e) {
      console.warn('[TaskManager] Delete failed (offline mode):', e);
      // Fallback: Delete locally
      const index = tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
          tasks.splice(index, 1);
          saveTasks();
          return true;
      }
  }
  return false;
}

/**
 * Start a task (begin session)
 * @param {string} taskId - Task ID
 */
async function startTask(taskId) {
  try {
      const response = await fetch(`${API_URL}/${taskId}/start`, {
          method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          // Update local
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          
          // Also pause other tasks locally if backend logic didn't sync them yet
          // (Actually backend handles pause of others, so reloading all tasks might be safer 
          // but for performance we just trust the return)
          
          // We need to refresh other tasks status though. 
          // The backend logic: "Pause any other active task first".
          // So other tasks changed state. We should reload or manually update local state.
          await loadTasks(); 
          
          saveTasks();
          startAutoSaveInterval();
          
          // Notify main process
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('task:started', taskId);
                } catch(e){}
            }
          
          return data.task;
      }
  } catch (e) {
      console.error('[TaskManager] Start failed:', e);
  }
  return null;
}

/**
 * Pause a task (end current session)
 * @param {string} taskId - Task ID
 */
async function pauseTask(taskId) {
  try {
      const response = await fetch(`${API_URL}/${taskId}/pause`, {
          method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          
          saveTasks();
          
            if (!getActiveTask()) {
                stopAutoSaveInterval();
            }

            // Notify main process
            if (typeof require !== 'undefined') {
                try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('task:paused', taskId);
                } catch(e){}
            }
          
          return data.task;
      }
  } catch (e) {
      console.error('[TaskManager] Pause failed:', e);
  }
  return null;
}

/**
 * Complete a task
 * @param {string} taskId - Task ID
 */
async function completeTask(taskId) {
    try {
      const response = await fetch(`${API_URL}/${taskId}/complete`, {
          method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          saveTasks();
          
           // Notify main process
            if (typeof require !== 'undefined') {
                try{
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('task:completed', taskId);
                }catch(e){}
            }
            
          return data.task;
      }
  } catch (e) {
      console.error('[TaskManager] Complete failed:', e);
  }
  return null;
}

/**
 * Mark a task as abandoned
 * @param {string} taskId - Task ID
 */
async function abandonTask(taskId) {
    try {
      const response = await fetch(`${API_URL}/${taskId}/abandon`, {
          method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          saveTasks();
          return data.task;
      }
  } catch (e) {
      console.error('[TaskManager] Abandon failed:', e);
  }
  return null;
}

/**
 * Toggle task completion (for checkbox)
 * @param {number} index - Task index
 */
async function toggleDone(index) {
  const task = tasks[index];
  if (!task) return;

  if (task.done) {
     // Backend doesn't have "uncomplete" endpoint explicitly, but updateTask works
     await updateTask(task.id, { 
         done: false, 
         status: task.sessions.length > 0 ? 'paused' : 'pending' 
     });
  } else {
    // Complete task
    await completeTask(task.id);
  }
  
  // Reload to ensure sync
  await loadTasks();
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

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Calculate estimated duration from subtasks
 * @param {Object} task - Task object
 * @returns {number} Total estimated duration in minutes
 */
function calculateEstimatedDuration(task) {
  if (!task.subtasks || task.subtasks.length === 0) {
    return 0;
  }

  return task.subtasks.reduce((total, subtask) => {
    return total + (subtask.estimatedDuration || 0);
  }, 0);
}

/**
 * Log activity to task's activity log
 * @param {string} taskId - Task ID
 * @param {Object} activityData - Activity data {appName, windowTitle, category, detail, isWorking}
 */
async function logActivity(taskId, activityData) {
  const task = getTaskById(taskId);
  if (!task || task.status !== 'started') return;

  if (!task.activityLog) {
    task.activityLog = [];
  }

  // Add activity entry with timestamp
  const logEntry = {
    timestamp: Date.now(),
    appName: activityData.appName || '-',
    windowTitle: activityData.windowTitle || '-',
    category: activityData.category || 'other',
    detail: activityData.detail || activityData.appName || '-',
    isWorking: activityData.isWorking !== undefined ? activityData.isWorking : true
  };
  
  task.activityLog.push(logEntry);

  // Keep only last 24 hours of activity logs to prevent excessive data
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  task.activityLog = task.activityLog.filter(log => log.timestamp >= oneDayAgo);

  saveTasks(); // Local backup
  
  // Sync to backend
  // We send the entire log array for now, or just the new entry if we create a specific endpoint later.
  // Using updateTask sends the whole task object or parts. 
  // To avoid huge payloads, ideally we'd have a specific endpoint, but for now we sync the updated list.
  try {
     // Don't await this to keep UI responsive
     updateTask(taskId, { activityLog: task.activityLog });
  } catch (e) {
      console.warn('[TaskManager] Failed to sync activity log:', e);
  }
}

/**
 * Add a subtask to a task
 * @param {string} taskId - Task ID
 * @param {Object} subtaskData - Subtask data {text, estimatedDuration}
 * @returns {Object} Updated task
 */
async function addSubtask(taskId, subtaskData) {
    try {
      const response = await fetch(`${API_URL}/${taskId}/subtasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subtaskData)
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          saveTasks();
          return data.task;
      }
    } catch (e) {
        console.error('[TaskManager] Add subtask failed:', e);
    }
  return null;
}

/**
 * Delete a subtask from a task
 * @param {string} taskId - Task ID
 * @param {string} subtaskId - Subtask ID
 * @returns {Object} Updated task
 */
async function deleteSubtask(taskId, subtaskId) {
  // Backend doesn't have explicit delete subtask endpoint yet?
  // We can use updateTask and filter subtasks
  const task = getTaskById(taskId);
  if (!task) return null;
  
  const newSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
  return await updateTask(taskId, { subtasks: newSubtasks });
}

/**
 * Toggle subtask done status
 * @param {string} taskId - Task ID
 * @param {string} subtaskId - Subtask ID
 * @returns {Object} Updated task
 */
async function toggleSubtask(taskId, subtaskId) {
    try {
      const response = await fetch(`${API_URL}/${taskId}/subtasks/${subtaskId}/toggle`, {
          method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.task) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) tasks[index] = data.task;
          
          recalculateTMT(taskId); // Update TMT locally/remotely
          saveTasks();
          return data.task;
      }
    } catch (e) {
        console.error('[TaskManager] Toggle subtask failed:', e);
    }
  return null;
}

/**
 * Update a subtask
 * @param {string} taskId - Task ID
 * @param {string} subtaskId - Subtask ID
 * @param {Object} updates - Fields to update {text, estimatedDuration}
 * @returns {Object} Updated task
 */
async function updateSubtask(taskId, subtaskId, updates) {
  // Manual update via updateTask since backend doesn't have specific endpoint
  const task = getTaskById(taskId);
  if (!task) return null;
  
  const subtasks = task.subtasks.map(st => {
      if (st.id === subtaskId) {
          return { ...st, ...updates };
      }
      return st;
  });
  
  return await updateTask(taskId, { subtasks });
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
    recalculateTMT,
    // Subtask management
    addSubtask,
    deleteSubtask,
    toggleSubtask,
    updateSubtask,
    calculateEstimatedDuration,
    // Activity tracking
    logActivity,
    syncTasks // Exported for manual sync
  };
}
