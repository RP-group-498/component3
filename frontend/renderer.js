/**
 * Main Renderer - Integrates all modules and handles UI events
 * Phase 1 Complete Implementation
 */

let ipcRenderer;
try {
  // Try to load electron if available (desktop app)
  if (typeof require !== 'undefined') {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
  } else {
    throw new Error('require is not defined');
  }
} catch (e) {
  console.warn('[Renderer] Electron not detected. Running in browser mode.');
  // Mock ipcRenderer for browser testing
  ipcRenderer = {
    on: (channel, listener) => {
      console.log(`[MockIPC] Listening on ${channel}`);
    },
    send: (channel, data) => {
      console.log(`[MockIPC] Sending to ${channel}:`, data);
    },
    invoke: async (channel, data) => {
      console.log(`[MockIPC] Invoking ${channel}:`, data);
      return null;
    }
  };
}

// DOM Element References
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const taskModal = document.getElementById('taskModal');
const modalTitle = document.querySelector('.modal-title');
const cancelBtn = document.getElementById('cancelBtn');
const createBtn = document.getElementById('createBtn');

// Form Elements
const modalTaskName = document.getElementById('modalTaskName');
const deadlineDate = document.getElementById('deadlineDate');
const deadlineTime = document.getElementById('deadlineTime');
const category = document.getElementById('category');

// Chart Elements
const motivationCanvas = document.getElementById('motivationCanvas');
const avgMotivationEl = document.getElementById('avgMotivation');
const motivationTrendEl = document.getElementById('motivationTrend');

let currentEditingTaskId = null;
let currentDeletingTaskId = null;
let currentTaskFilter = 'all'; // Task filter state

// Initialize Application
async function init() {
  console.log('[App] Initializing Phase 1...');

  // Initialize EventLogger
  try {
    if (typeof EventLogger !== 'undefined') {
      const eventLoggerInit = await EventLogger.initEventLogger();
      if (!eventLoggerInit.success) {
        console.error('[App] Failed to initialize event logger');
      }
    } else {
      console.warn('[App] EventLogger module not loaded');
    }
  } catch (e) {
    console.error('[App] Error initializing EventLogger:', e);
  }

  // Initialize UIManager
  try {
    if (typeof UIManager !== 'undefined') {
      UIManager.initUI({
        taskList,
        taskModal,
        modalTitle,
        createBtn,
        modalTaskName,
        deadlineDate,
        deadlineTime,
        category
      });
    } else {
      console.error('[App] UIManager module not loaded');
    }
  } catch (e) {
    console.error('[App] Error initializing UIManager:', e);
  }

  // Initialize Intervention Manager (implicit via loading script, but good to log)
  console.log('[App] Intervention Engine active');

  // Load tasks
  try {
    if (typeof TaskManager !== 'undefined') {
      await TaskManager.loadTasks();

      // Check for crashed session
      const crashed = TaskManager.checkForCrashedSession();
      if (crashed) {
        const recover = confirm(
          `It looks like the app crashed during a session for "${crashed.task.text}". ` +
          `Would you like to recover the ${crashed.estimatedDuration}m session?`
        );
        if (recover) {
          await TaskManager.recoverCrashedSession(crashed.task.id);
        }
      }
    } else {
      console.error('[App] TaskManager module not loaded');
    }
  } catch (e) {
    console.error('[App] Error loading tasks:', e);
  }

  // Initial render
  try {
    render();
  } catch (e) {
    console.error('[App] Error rendering:', e);
  }

  // Wire up event handlers
  try {
    wireUpEventHandlers();
  } catch (e) {
    console.error('[App] Error wiring event handlers:', e);
  }

  // Initialize motivation chart
  try {
    if (motivationCanvas && typeof MotivationChart !== 'undefined') {
      MotivationChart.initChart(motivationCanvas);
      updateChart();
    } else {
        console.warn('[App] MotivationChart not loaded or canvas missing');
    }
  } catch (e) {
    console.error('[App] Error initializing chart:', e);
  }

  // Setup period selector buttons
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      periodButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      // Update chart period
      const period = btn.dataset.period;
      if (typeof MotivationChart !== 'undefined') {
          MotivationChart.setPeriod(period);
          updateChart();
      }
    });
  });

  // Setup task filter tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      // Update filter
      currentTaskFilter = btn.dataset.filter;
      render();
    });
  });

  // Setup CSV download button
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
      if (typeof TaskManager !== 'undefined' && typeof MotivationChart !== 'undefined') {
        const tasks = TaskManager.getAllTasks();
        if (tasks.length === 0) {
          alert('No tasks available to download. Create some tasks first!');
          return;
        }
        MotivationChart.downloadCSV(tasks);
      }
    });
  }

  // Setup real-time TMT recalculation and chart polling (every 60 seconds)
  setInterval(() => {
    if (typeof TaskManager !== 'undefined') {
        // Sync any offline/dirty tasks to backend
        TaskManager.syncTasks();

        // Recalculate TMT for all tasks (Delay changes as time passes)
        const tasks = TaskManager.getAllTasks();
        tasks.forEach(task => {
        if (task.status !== 'completed' && task.status !== 'abandoned') {
            TaskManager.recalculateTMT(task.id);
        }
        });

        // Update chart with new TMT values
        updateChart();
        console.log('[App] TMT recalculated and chart updated');
    }
  }, 60000); // 60 seconds

  // Setup active window monitoring IPC listeners
  try {
    setupActiveWindowListeners();
  } catch (e) {
      console.warn('[App] Failed to setup active window listeners:', e);
  }

  // Log app started (not in spec, but useful)
  console.log('[App] Phase 1 initialized successfully');
}

// Setup active window monitoring listeners
function setupActiveWindowListeners() {
  // Track procrastination time
  let procrastinationStartTime = null;
  let currentCategory = null;

  // Track productive time
  let productiveStartTime = null;
  let productiveCategory = null;

  // Track last working state for app switches
  let lastWorkingState = true;

  // Listen for active window updates (every 10 seconds from main process)
  ipcRenderer.on('active-window:update', (event, data) => {
    const { taskId, appName, windowTitle, isWorking, category, detail, confidence, isProcrastinating, timestamp } = data;

    // Log detailed activity to task's activity log
    TaskManager.logActivity(taskId, {
      appName,
      windowTitle,
      category,
      detail,
      isWorking
    });

    if (isProcrastinating) {
      // User is procrastinating
      if (!procrastinationStartTime) {
        procrastinationStartTime = timestamp;
        currentCategory = category;

        const logMsg = category === 'procrastinating-web'
          ? `Procrastination started: ${detail} (Website)`
          : `Procrastination started: ${appName}`;
        console.log(`[Procrastination] ${logMsg}`);
      }

      // End productive time tracking
      if (productiveStartTime && productiveCategory) {
        const productiveDuration = (timestamp - productiveStartTime) / 1000; // seconds
        const task = TaskManager.getTaskById(taskId);
        if (task && window.TMTEngine && productiveDuration > 5) { // Only track if > 5 seconds
          window.TMTEngine.updateBehavioralData(task, 'productive_time_tracked', {
            duration: productiveDuration,
            category: productiveCategory
          });
          TaskManager.saveTasks();
        }
        productiveStartTime = null;
        productiveCategory = null;
      }
    } else {
      // User is working (IDE or academic website)
      if (procrastinationStartTime) {
        const procrastinationDuration = (timestamp - procrastinationStartTime) / 1000; // seconds

        const logMsg = category === 'academic-web'
          ? `Resumed work: ${detail} (Academic Website)`
          : category === 'ide'
            ? `Resumed work: ${appName} (IDE)`
            : `Resumed work: ${detail}`;

        console.log(`[Procrastination] Ended after ${procrastinationDuration}s - ${logMsg}`);

        // Update task behavioral data
        const task = TaskManager.getTaskById(taskId);
        if (task && window.TMTEngine) {
          window.TMTEngine.updateBehavioralData(task, 'procrastination_detected', {
            duration: procrastinationDuration,
            category: currentCategory,
            detail: detail
          });
          TaskManager.recalculateTMT(taskId);
        }

        procrastinationStartTime = null;
        currentCategory = null;
      }

      // Start/continue productive time tracking
      if (category === 'ide' || category === 'academic-web') {
        if (!productiveStartTime || productiveCategory !== category) {
          // Save previous productive session if category changed
          if (productiveStartTime && productiveCategory) {
            const productiveDuration = (timestamp - productiveStartTime) / 1000;
            const task = TaskManager.getTaskById(taskId);
            if (task && window.TMTEngine && productiveDuration > 5) {
              window.TMTEngine.updateBehavioralData(task, 'productive_time_tracked', {
                duration: productiveDuration,
                category: productiveCategory
              });
              TaskManager.saveTasks();
            }
          }
          // Start new productive session
          productiveStartTime = timestamp;
          productiveCategory = category;
        }

        // Log productive activity
        if (category === 'academic-web') {
          console.log(`[Academic Work] ${detail} (confidence: ${(confidence * 100).toFixed(0)}%)`);
        } else if (category === 'ide') {
          console.log(`[IDE Work] ${appName}`);
        }
      }
    }

    // Update last working state for next app switch
    lastWorkingState = isWorking;
  });

  // Listen for app switches
  ipcRenderer.on('active-window:switch', (event, data) => {
    const { taskId, from, to, toDetail, toCategory, isWorking, timestamp } = data;

    const categoryLabels = {
      'ide': 'IDE',
      'academic-web': 'Academic Website',
      'procrastinating-web': 'Procrastinating',
      'neutral-web': 'Neutral Website',
      'other-app': 'Other App'
    };

    const label = categoryLabels[toCategory] || toCategory;
    console.log(`[App Switch] ${from} -> ${toDetail || to} (${label})`);

    // Log app switch event with fromWorking state
    const task = TaskManager.getTaskById(taskId);
    if (task && window.TMTEngine) {
      window.TMTEngine.updateBehavioralData(task, 'app_switched', {
        from,
        to: toDetail || to,
        category: toCategory,
        isWorking,
        fromWorking: lastWorkingState // Include previous working state
      });

      // Increment app background events count for non-productive switches
      if (!isWorking) {
        task.appBackgroundEvents = (task.appBackgroundEvents || 0) + 1;
        TaskManager.saveTasks();
      }

      TaskManager.recalculateTMT(taskId);
    }

    // Update last working state
    lastWorkingState = isWorking;
  });
}

// Setup Demo Buttons
function setupDemoButtons() {
    console.log('[Demo] Setting up buttons...');
    const demoButtons = document.querySelectorAll('.demo-btn');
    
    if (demoButtons.length === 0) {
        console.warn('[Demo] No demo buttons found in DOM');
        return;
    }

    demoButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('[Demo] Button clicked:', btn.dataset.strategy);
            
            try {
                if (typeof InterventionUI === 'undefined') {
                    alert('Error: InterventionUI module not loaded.');
                    return;
                }

                const strategy = btn.dataset.strategy;
                
                // Safe task ID retrieval
                let taskId = 'demo_task_id';
                if (typeof TaskManager !== 'undefined') {
                    const active = TaskManager.getActiveTask();
                    const all = TaskManager.getAllTasks();
                    if (active) taskId = active.id;
                    else if (all && all.length > 0) taskId = all[0].id;
                }

                const mockInterventionId = 'demo_' + Date.now();
                
                if (strategy === 'notification') {
                    InterventionUI.showNotification(
                        "Focus Nudge", 
                        "Hey! You seem a bit distracted. Let's get back to it."
                    );
                } else {
                    let title = "Intervention";
                    let body = "Let's try a strategy.";
                    
                    switch(strategy) {
                        case 'pomodoro':
                            title = "Distracted?";
                            body = "Let's try a Pomodoro session. 25 minutes of focus, then a break.";
                            break;
                        case 'two_minute_rule':
                            title = "Feeling Stuck?";
                            body = "Try the 2-Minute Rule: Just commit to working for 2 minutes.";
                            break;
                        case 'breathing':
                            title = "High Anxiety?";
                            body = "Let's take a deep breath together. Box breathing: 4-4-4-4.";
                            break;
                        case 'reframing':
                            title = "Low Value?";
                            body = "Remember why this task matters to your long-term goals.";
                            break;
                        case 'break':
                            title = "Fatigue Detected";
                            body = "You've been working hard. Time for a 5-minute break?";
                            break;
                    }
                    
                    InterventionUI.showInterventionModal(strategy, {
                        title,
                        body,
                        taskId,
                        interventionId: mockInterventionId
                    });
                }
            } catch (e) {
                console.error('[Demo] Error triggering intervention:', e);
                alert('Demo Error: ' + e.message);
            }
        });
    });
}

// Wire up all event handlers
function wireUpEventHandlers() {
  // Add task button
  addBtn.addEventListener('click', () => {
    currentEditingTaskId = null;
    UIManager.showCreateModal(handleTaskSubmit);
  });
  
  // Setup Demo Buttons
  setupDemoButtons();

  // Cancel modal
  cancelBtn.addEventListener('click', () => {
    UIManager.hideTaskModal();
    currentEditingTaskId = null;
  });

  // Create/Save button
  createBtn.addEventListener('click', handleTaskSubmit);

  // Subtask modal buttons
  const subtaskCancelBtn = document.getElementById('subtaskCancelBtn');
  const subtaskSaveBtn = document.getElementById('subtaskSaveBtn');
  const subtaskModal = document.getElementById('subtaskModal');

  if (subtaskCancelBtn) {
    subtaskCancelBtn.addEventListener('click', hideSubtaskModal);
  }

  if (subtaskSaveBtn) {
    subtaskSaveBtn.addEventListener('click', handleSubtaskSubmit);
  }

  // Close subtask modal on backdrop click
  if (subtaskModal) {
    subtaskModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        hideSubtaskModal();
      }
    });
  }

  // Keyboard shortcut for subtask modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && subtaskModal && subtaskModal.classList.contains('visible')) {
      hideSubtaskModal();
    }
  });

  // Form validation on input
  [modalTaskName, deadlineDate, deadlineTime, category].forEach(el => {
    if (el) {
      el.addEventListener('input', validateForm);
      el.addEventListener('change', validateForm);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (taskModal.classList.contains('open')) {
        UIManager.hideTaskModal();
        currentEditingTaskId = null;
      }
      // Close delete modal on Escape
      const deleteModal = document.getElementById('deleteTaskModal');
      if (deleteModal && deleteModal.classList.contains('visible')) {
        hideDeleteModal();
      }
    }
  });

  // Delete modal handlers
  const deleteModal = document.getElementById('deleteTaskModal');
  const deleteMistakeBtn = document.getElementById('deleteMistakeBtn');
  const deleteAbandonBtn = document.getElementById('deleteAbandonBtn');
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');

  if (deleteMistakeBtn) {
    deleteMistakeBtn.addEventListener('click', async () => {
      if (currentDeletingTaskId) {
        await TaskManager.deleteTask(currentDeletingTaskId);
        render();
        hideDeleteModal();
      }
    });
  }

  if (deleteAbandonBtn) {
    deleteAbandonBtn.addEventListener('click', async () => {
      if (currentDeletingTaskId) {
        await TaskManager.abandonTask(currentDeletingTaskId);
        render();
        hideDeleteModal();
      }
    });
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', hideDeleteModal);
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        hideDeleteModal();
      }
    });
  }
}

// Render task list
function render() {
  let tasks = TaskManager.getAllTasks();

  // Filter tasks based on selected tab
  if (currentTaskFilter !== 'all') {
    tasks = tasks.filter(task => {
      if (currentTaskFilter === 'pending') {
        return task.status === 'pending';
      } else if (currentTaskFilter === 'started') {
        return task.status === 'started' || task.status === 'paused';
      } else if (currentTaskFilter === 'completed') {
        return task.status === 'completed';
      }
      return true;
    });
  }

  UIManager.renderTaskList(tasks);
  updateChart();

  // Reinitialize Lucide icons after rendering
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Update motivation chart
async function updateChart() {
  const tasks = TaskManager.getAllTasks();

  if (MotivationChart && motivationCanvas) {
    await MotivationChart.renderChart(tasks);

    // Update stats
    if (avgMotivationEl) {
      const avg = MotivationChart.getAverageMotivation(tasks);
      avgMotivationEl.textContent = avg > 0 ? avg : '-';

      // Toggle red theme based on motivation
      if (avg > 0 && avg <= 3) {
        document.body.classList.add('red-theme');
      } else {
        document.body.classList.remove('red-theme');
      }
    }

    if (motivationTrendEl) {
      const trend = MotivationChart.getMotivationTrend(tasks);
      const trendIcons = {
        increasing: '<i data-lucide="trending-up"></i> Rising',
        decreasing: '<i data-lucide="trending-down"></i> Falling',
        stable: '<i data-lucide="minus"></i> Stable'
      };
      motivationTrendEl.innerHTML = tasks.length >= 2 ? trendIcons[trend] : '-';

      // Color code the trend
      const trendColors = {
        increasing: '#10b981',
        decreasing: '#ef4444',
        stable: '#f59e0b'
      };
      motivationTrendEl.style.color = trendColors[trend] || '#6b7280';

      // Reinitialize icons for trend display
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}

// Form validation
function validateForm() {
  let isValid = true;
  const errors = {};

  // Task name required
  if (!modalTaskName.value.trim()) {
    errors.name = 'Task name is required';
    isValid = false;
  }

  // Deadline date required
  if (!deadlineDate.value) {
    errors.date = 'Deadline date is required';
    isValid = false;
  }

  // Deadline time required
  if (!deadlineTime.value) {
    errors.time = 'Deadline time is required';
    isValid = false;
  }

  // Category required
  if (!category.value) {
    errors.category = 'Category is required';
    isValid = false;
  }

  // Update error displays
  document.getElementById('nameError').textContent = errors.name || '';
  document.getElementById('dateError').textContent = errors.date || '';
  document.getElementById('timeError').textContent = errors.time || '';
  document.getElementById('categoryError').textContent = errors.category || '';

  // Enable/disable create button
  createBtn.disabled = !isValid;

  return isValid;
}

// Note: TMT variables are now calculated automatically from behavioral data
// No manual slider inputs needed

// Handle task submit (create or edit)
async function handleTaskSubmit() {
  if (!validateForm()) return;

  // Disable button to prevent double-click
  createBtn.disabled = true;
  createBtn.textContent = 'Saving...';

  const taskData = {
    text: modalTaskName.value.trim(),
    deadlineDate: deadlineDate.value,
    deadlineTime: deadlineTime.value,
    category: category.value
    // Note: estimatedDuration is now calculated from subtasks
    // Note: TMT values (expectancy, value, impulsivity, delay) are calculated automatically
  };

  try {
    if (currentEditingTaskId) {
      // Edit mode
      await TaskManager.updateTask(currentEditingTaskId, taskData);
      // Recalculate TMT values after edit
      TaskManager.recalculateTMT(currentEditingTaskId);
      currentEditingTaskId = null;
    } else {
      // Create mode
      await TaskManager.createTask(taskData);
    }

    UIManager.hideTaskModal();
    render();
    resetForm();
  } catch (error) {
    console.error('Failed to save task:', error);
    alert('Failed to save task. Please try again.');
    // Re-enable button
    createBtn.disabled = false;
    createBtn.textContent = currentEditingTaskId ? 'Save Changes' : 'Create';
  }
}

// Reset form
function resetForm() {
  modalTaskName.value = '';
  deadlineDate.value = '';
  deadlineTime.value = '';
  category.value = 'personal';

  // Clear errors
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  createBtn.disabled = true;
}

// Global handlers for UI callbacks
window.handleToggleDone = async function (index) {
  await TaskManager.toggleDone(index);
  render();
};

window.handleStartTask = async function (taskId) {
  await TaskManager.startTask(taskId);
  render();
};

window.handlePauseTask = async function (taskId) {
  await TaskManager.pauseTask(taskId);
  render();
};

window.handleEditTask = async function (taskId) {
  const task = TaskManager.getTaskById(taskId);
  if (!task) return;

  currentEditingTaskId = taskId;

  // Log edit opened event
  await EventLogger.logEvent('task_edited', { task_id: taskId });

  UIManager.showEditModal(task, async () => {
    await handleTaskSubmit();
  });
};

window.handleDeleteTask = async function (taskId, index) {
  const task = TaskManager.getTaskById(taskId);
  if (!task) return;

  currentDeletingTaskId = taskId;

  // Warn if task is active
  if (task.status === 'started') {
    const confirmed = confirm(
      `"${task.text}" is currently active. Deleting will stop the timer. Continue?`
    );
    if (!confirmed) {
      currentDeletingTaskId = null;
      return;
    }
  }

  showDeleteModal(task);
};

// Subtask handlers
let currentSubtaskTaskId = null;

window.handleAddSubtask = function (taskId) {
  currentSubtaskTaskId = taskId;
  showSubtaskModal();
};

window.handleToggleSubtask = async function (taskId, subtaskId) {
  await TaskManager.toggleSubtask(taskId, subtaskId);
  render();
};

window.handleDeleteSubtask = async function (taskId, subtaskId) {
  await TaskManager.deleteSubtask(taskId, subtaskId);
  render();
};

function showSubtaskModal() {
  const modal = document.getElementById('subtaskModal');
  const textInput = document.getElementById('subtaskText');
  const hoursInput = document.getElementById('subtaskHours');
  const minutesInput = document.getElementById('subtaskMinutes');
  const errorDiv = document.getElementById('subtaskFormError');

  // Clear form
  textInput.value = '';
  hoursInput.value = 0;
  minutesInput.value = 0;
  errorDiv.textContent = '';

  modal.classList.add('visible');
  textInput.focus();
}

function hideSubtaskModal() {
  const modal = document.getElementById('subtaskModal');
  modal.classList.remove('visible');
  currentSubtaskTaskId = null;
}

function showDeleteModal(task) {
  const modal = document.getElementById('deleteTaskModal');
  const message = document.getElementById('deleteTaskMessage');

  message.textContent = `Why are you removing "${task.text}"?`;
  modal.classList.add('visible');
}

function hideDeleteModal() {
  const modal = document.getElementById('deleteTaskModal');
  modal.classList.remove('visible');
  currentDeletingTaskId = null;
}

async function handleSubtaskSubmit() {
  const textInput = document.getElementById('subtaskText');
  const hoursInput = document.getElementById('subtaskHours');
  const minutesInput = document.getElementById('subtaskMinutes');
  const errorDiv = document.getElementById('subtaskFormError');

  const text = textInput.value.trim();
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;

  if (!text) {
    errorDiv.textContent = 'Please enter a subtask description';
    return;
  }

  const estimatedDuration = hours * 60 + minutes;

  try {
    await TaskManager.addSubtask(currentSubtaskTaskId, {
      text,
      estimatedDuration
    });

    hideSubtaskModal();
    render();
  } catch (error) {
    errorDiv.textContent = 'Error adding subtask: ' + error.message;
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Handle app closing with active session
window.addEventListener('beforeunload', (e) => {
  const activeTask = TaskManager.getActiveTask();

  if (activeTask) {
    e.preventDefault();
    e.returnValue = 'You have an active session. Progress will be saved.';
    return e.returnValue;
  }
});

console.log('[Renderer] Loaded');
