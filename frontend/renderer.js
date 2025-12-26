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

// Chart Elements
const motivationCanvas = document.getElementById('motivationCanvas');
const avgMotivationEl = document.getElementById('avgMotivation');
const motivationTrendEl = document.getElementById('motivationTrend');

let currentEditingTaskId = null;
let currentTaskFilter = 'all'; // Task filter state

// Initialize Application
async function init() {
  console.log('[App] Initializing Phase 1...');

  // Initialize EventLogger
  const eventLoggerInit = await EventLogger.initEventLogger();
  if (!eventLoggerInit.success) {
    console.error('[App] Failed to initialize event logger');
  }

  // Initialize UIManager
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

  // Initialize Intervention Manager (implicit via loading script, but good to log)
  console.log('[App] Intervention Engine active');

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
      const tasks = TaskManager.getAllTasks();
      if (tasks.length === 0) {
        alert('No tasks available to download. Create some tasks first!');
        return;
      }
      MotivationChart.downloadCSV(tasks);
    });
  }

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

  // Setup active window monitoring IPC listeners
  setupActiveWindowListeners();

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
    if (e.key === 'Escape' && taskModal.classList.contains('open')) {
      UIManager.hideTaskModal();
      currentEditingTaskId = null;
    }
  });
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
function updateChart() {
  const tasks = TaskManager.getAllTasks();

  if (MotivationChart && motivationCanvas) {
    MotivationChart.renderChart(tasks);

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

  const taskData = {
    text: modalTaskName.value.trim(),
    deadlineDate: deadlineDate.value,
    deadlineTime: deadlineTime.value,
    category: category.value
    // Note: estimatedDuration is now calculated from subtasks
    // Note: TMT values (expectancy, value, impulsivity, delay) are calculated automatically
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
