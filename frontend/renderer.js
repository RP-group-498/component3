/**
 * Main Renderer - Integrates all modules and handles UI events
 * Phase 1 Complete Implementation
 */

const { ipcRenderer } = require('electron');

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
const durationHours = document.getElementById('durationHours');
const durationMinutes = document.getElementById('durationMinutes');

// Timer Elements
const timerContainer = document.getElementById('timerContainer');
const timerTaskName = document.getElementById('timerTaskName');
const timerMinutes = document.getElementById('timerMinutes');
const timerStatus = document.getElementById('timerStatus');
const timerProgress = document.getElementById('timerProgress');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resumeTimerBtn = document.getElementById('resumeTimerBtn');
const stopTimerBtn = document.getElementById('stopTimerBtn');
const skipBreakBtn = document.getElementById('skipBreakBtn');
const closeTimerBtn = document.getElementById('closeTimerBtn');

// Chart Elements
const motivationCanvas = document.getElementById('motivationCanvas');
const avgMotivationEl = document.getElementById('avgMotivation');
const motivationTrendEl = document.getElementById('motivationTrend');

let currentEditingTaskId = null;

// Initialize Application
async function init() {
  console.log('[App] Initializing Phase 1...');

  // Initialize EventLogger
  const eventLoggerInit = await EventLogger.initEventLogger();
  if (!eventLoggerInit.success) {
    console.error('[App] Failed to initialize event logger');
  }

  // Initialize FocusTimer
  await FocusTimer.initTimer();

  // Initialize UIManager
  UIManager.initUI({
    taskList,
    taskModal,
    modalTitle,
    createBtn,
    modalTaskName,
    deadlineDate,
    deadlineTime,
    category,
    durationHours,
    durationMinutes,
    timerContainer,
    timerTaskName,
    timerMinutes,
    timerStatus,
    timerProgress
  });

  // Load tasks
  TaskManager.loadTasks();

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

  // Initial render
  render();

  // Wire up event handlers
  wireUpEventHandlers();

  // Setup focus timer callbacks
  setupFocusTimer();

  // Initialize motivation chart
  if (motivationCanvas) {
    MotivationChart.initChart(motivationCanvas);
    updateChart();
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
      MotivationChart.setPeriod(period);
      updateChart();
    });
  });

  // Setup real-time TMT recalculation and chart polling (every 60 seconds)
  setInterval(() => {
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
  }, 60000); // 60 seconds

  // Log app started (not in spec, but useful)
  console.log('[App] Phase 1 initialized successfully');
}

// Wire up all event handlers
function wireUpEventHandlers() {
  // Add task button
  addBtn.addEventListener('click', () => {
    currentEditingTaskId = null;
    UIManager.showCreateModal(handleTaskSubmit);
  });

  // Cancel modal
  cancelBtn.addEventListener('click', () => {
    UIManager.hideTaskModal();
    currentEditingTaskId = null;
  });

  // Create/Save button
  createBtn.addEventListener('click', handleTaskSubmit);

  // Form validation on input
  [modalTaskName, deadlineDate, deadlineTime, category].forEach(el => {
    if (el) {
      el.addEventListener('input', validateForm);
      el.addEventListener('change', validateForm);
    }
  });

  // Timer controls
  pauseTimerBtn.addEventListener('click', handlePauseTimer);
  resumeTimerBtn.addEventListener('click', handleResumeTimer);
  stopTimerBtn.addEventListener('click', handleStopTimer);
  skipBreakBtn.addEventListener('click', handleSkipBreak);
  closeTimerBtn.addEventListener('click', () => {
    UIManager.hideTimerUI();
    FocusTimer.stopTimer();
    ipcRenderer.send('timer:stop');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && taskModal.classList.contains('open')) {
      UIManager.hideTaskModal();
      currentEditingTaskId = null;
    }
  });
}

// Setup focus timer callbacks
function setupFocusTimer() {
  FocusTimer.onTimerTick((minutes, seconds) => {
    const state = FocusTimer.getTimerState();
    UIManager.updateTimerDisplay(minutes, seconds, state);

    // Update button visibility based on pause state
    if (state.isPaused) {
      pauseTimerBtn.style.display = 'none';
      resumeTimerBtn.style.display = 'block';
    } else {
      pauseTimerBtn.style.display = 'block';
      resumeTimerBtn.style.display = 'none';
    }

    // Show/hide skip break button
    if (state.isBreak) {
      skipBreakBtn.style.display = 'block';
    } else {
      skipBreakBtn.style.display = 'none';
    }

    // Send timer update to system tray
    const task = state.taskId ? TaskManager.getTaskById(state.taskId) : null;
    ipcRenderer.send('timer:update', {
      minutes,
      seconds,
      isActive: state.isActive,
      isBreak: state.isBreak,
      taskName: task ? task.text : null
    });

    // Update task UI to show real-time time
    render();
  });

  FocusTimer.onTimerComplete(() => {
    // Work session completed, show break prompt
    const breakDuration = 5; // Will be retrieved from settings
    alert(`Great work! Time for a ${breakDuration} minute break.`);
  });

  FocusTimer.onBreakComplete(async () => {
    // Break completed - ask user if they want to continue
    const continueSession = confirm('Break is over! Start another focus session?');

    if (continueSession) {
      // Get the current task from timer state
      const timerState = FocusTimer.getTimerState();
      const taskId = timerState.taskId;

      if (taskId) {
        // Start a new focus session for the same task
        await FocusTimer.startFocusSession(taskId, 25);
        render();
      } else {
        // No task ID found, close timer
        UIManager.hideTimerUI();
        ipcRenderer.send('timer:stop');
        render();
      }
    } else {
      // User chose not to continue, close timer
      UIManager.hideTimerUI();
      ipcRenderer.send('timer:stop');
      render();
    }
  });
}

// Render task list
function render() {
  const tasks = TaskManager.getAllTasks();
  UIManager.renderTaskList(tasks);
  updateChart();
}

// Update motivation chart
function updateChart() {
  const tasks = TaskManager.getAllTasks();

  if (MotivationChart && motivationCanvas) {
    MotivationChart.renderChart(tasks);

    // Update stats
    if (avgMotivationEl) {
      const avg = MotivationChart.getAverageMotivation(tasks);
      avgMotivationEl.textContent = avg > 0 ? avg : '-';
    }

    if (motivationTrendEl) {
      const trend = MotivationChart.getMotivationTrend(tasks);
      const trendEmoji = {
        increasing: '📈 Rising',
        decreasing: '📉 Falling',
        stable: '➡️ Stable'
      };
      motivationTrendEl.textContent = tasks.length >= 2 ? trendEmoji[trend] : '-';

      // Color code the trend
      const trendColors = {
        increasing: '#10b981',
        decreasing: '#ef4444',
        stable: '#f59e0b'
      };
      motivationTrendEl.style.color = trendColors[trend] || '#6b7280';
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

  const estimatedDurationInMinutes =
    (parseInt(durationHours.value) || 0) * 60 +
    (parseInt(durationMinutes.value) || 0);

  const taskData = {
    text: modalTaskName.value.trim(),
    deadlineDate: deadlineDate.value,
    deadlineTime: deadlineTime.value,
    category: category.value,
    estimatedDuration: estimatedDurationInMinutes > 0 ? estimatedDurationInMinutes : null
    // Note: TMT values (expectancy, value, impulsivity, delay) are now calculated automatically
  };

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
}

// Reset form
function resetForm() {
  modalTaskName.value = '';
  deadlineDate.value = '';
  deadlineTime.value = '';
  category.value = 'personal';
  durationHours.value = '0';
  durationMinutes.value = '0';

  // Clear errors
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  createBtn.disabled = true;
}

// Global handlers for UI callbacks
window.handleToggleDone = async function(index) {
  await TaskManager.toggleDone(index);
  render();
};

window.handleStartTask = async function(taskId) {
  await TaskManager.startTask(taskId);
  render();
};

window.handlePauseTask = async function(taskId) {
  await TaskManager.pauseTask(taskId);
  render();
};

window.handleFocusMode = async function(taskId) {
  // Start the task if not already started
  const task = TaskManager.getTaskById(taskId);
  if (task.status !== 'started') {
    await TaskManager.startTask(taskId);
  }

  // Start focus timer
  await FocusTimer.startFocusSession(taskId, 25);

  // Show timer UI
  UIManager.showTimerUI(taskId);

  render();
};

window.handleEditTask = async function(taskId) {
  const task = TaskManager.getTaskById(taskId);
  if (!task) return;

  currentEditingTaskId = taskId;

  // Log edit opened event
  await EventLogger.logEvent('task_edited', { task_id: taskId });

  UIManager.showEditModal(task, async () => {
    await handleTaskSubmit();
  });
};

window.handleDeleteTask = async function(taskId, index) {
  const task = TaskManager.getTaskById(taskId);
  if (!task) return;

  // Warn if task is active
  if (task.status === 'started') {
    const confirmed = confirm(
      `"${task.text}" is currently active. Deleting will stop the timer. Continue?`
    );
    if (!confirmed) return;
  } else {
    const confirmed = confirm(`Delete "${task.text}"?`);
    if (!confirmed) return;
  }

  await TaskManager.deleteTask(taskId);
  render();
};

// Timer control handlers
async function handlePauseTimer() {
  FocusTimer.pauseTimer();

  const state = FocusTimer.getTimerState();
  if (state.taskId) {
    await TaskManager.pauseTask(state.taskId);
  }

  pauseTimerBtn.style.display = 'none';
  resumeTimerBtn.style.display = 'block';
  render();
}

async function handleResumeTimer() {
  FocusTimer.resumeTimer();

  const state = FocusTimer.getTimerState();
  if (state.taskId) {
    await TaskManager.startTask(state.taskId);
  }

  pauseTimerBtn.style.display = 'block';
  resumeTimerBtn.style.display = 'none';
  render();
}

async function handleStopTimer() {
  const confirmed = confirm('Stop the focus session?');
  if (!confirmed) return;

  const state = FocusTimer.getTimerState();
  if (state.taskId) {
    await TaskManager.pauseTask(state.taskId);
  }

  await FocusTimer.stopTimer();
  UIManager.hideTimerUI();
  ipcRenderer.send('timer:stop');
  render();
}

async function handleSkipBreak() {
  await FocusTimer.skipBreak();
  UIManager.hideTimerUI();
  ipcRenderer.send('timer:stop');
  render();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Handle app closing with active session
window.addEventListener('beforeunload', (e) => {
  const activeTask = TaskManager.getActiveTask();
  const timerState = FocusTimer.getTimerState();

  if (activeTask || timerState.isActive) {
    e.preventDefault();
    e.returnValue = 'You have an active session. Progress will be saved.';
    return e.returnValue;
  }
});

console.log('[Renderer] Loaded');
