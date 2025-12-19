/**
 * UI Manager Module
 * - Task list rendering with status badges
 * - Modal management (create/edit)
 * - Focus timer UI updates
 * - Real-time timer display
 * - Visual indicators
 */

// UI element references (will be set on init)
let elements = {};

/**
 * Initialize UI Manager
 * @param {Object} refs - DOM element references
 */
function initUI(refs) {
  elements = refs;
  console.log('[UIManager] Initialized');
  return { success: true };
}

/**
 * Render task list
 * @param {Array} tasks - Array of tasks
 */
function renderTaskList(tasks) {
  if (!elements.taskList) {
    console.warn('[UIManager] taskList element not found');
    return;
  }

  elements.taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks yet. Click "Add task" to get started!';
    elements.taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const taskElement = createTaskElement(task, index);
    elements.taskList.appendChild(taskElement);
  });
}

/**
 * Create task list item element
 * @param {Object} task - Task object
 * @param {number} index - Task index
 * @returns {HTMLElement} Task list item
 */
function createTaskElement(task, index) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.status === 'started' ? ' active' : '');
  li.dataset.taskId = task.id;
  li.dataset.index = index;

  const left = document.createElement('div');
  left.className = 'task-left';

  // Checkbox
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = task.status === 'completed';
  chk.addEventListener('change', () => {
    if (window.handleToggleDone) {
      window.handleToggleDone(index);
    }
  });

  const content = document.createElement('div');
  content.className = 'task-content';

  // Title row with text and category badge
  const titleRow = document.createElement('div');
  titleRow.className = 'task-title-row';

  const textSpan = document.createElement('div');
  textSpan.className = 'task-text' + (task.status === 'completed' ? ' completed' : '');
  textSpan.textContent = task.text;

  const categoryBadge = document.createElement('span');
  categoryBadge.className = `category-badge ${task.category}`;
  categoryBadge.textContent = task.category;

  // Status badge
  const statusBadge = createStatusBadge(task.status);

  titleRow.appendChild(textSpan);
  titleRow.appendChild(categoryBadge);
  titleRow.appendChild(statusBadge);

  // Details section
  const details = document.createElement('div');
  details.className = 'task-details';

  // Deadline
  if (task.deadlineDate) {
    const deadline = document.createElement('div');
    deadline.className = 'detail-item';
    deadline.textContent = `📅 ${task.deadlineDate}${task.deadlineTime ? ' ' + task.deadlineTime : ''}`;
    details.appendChild(deadline);
  }

  // Time tracking
  const timeInfo = createTimeTrackingInfo(task);
  if (timeInfo) {
    details.appendChild(timeInfo);
  }

  // TMT Metrics
  const metrics = createMetricsDisplay(task);
  if (metrics) {
    details.appendChild(metrics);
  }

  content.appendChild(titleRow);
  content.appendChild(details);

  left.appendChild(chk);
  left.appendChild(content);

  // Actions (right side)
  const actions = createTaskActions(task, index);

  li.appendChild(left);
  li.appendChild(actions);

  return li;
}

/**
 * Create status badge
 * @param {string} status - Task status
 * @returns {HTMLElement} Status badge
 */
function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `status-badge status-${status}`;

  const statusText = {
    pending: 'Pending',
    started: 'In Progress',
    paused: 'Paused',
    completed: 'Completed',
    abandoned: 'Abandoned'
  };

  badge.textContent = statusText[status] || status;
  return badge;
}

/**
 * Create time tracking info display
 * @param {Object} task - Task object
 * @returns {HTMLElement|null} Time info element
 */
function createTimeTrackingInfo(task) {
  if (!task.estimatedDuration && !task.actualTimeSpent && task.status === 'pending') {
    return null;
  }

  const timeDiv = document.createElement('div');
  timeDiv.className = 'detail-item time-tracking';

  const parts = [];

  // Actual time spent
  if (task.actualTimeSpent > 0 || task.status === 'started') {
    const totalTime = window.TaskManager
      ? window.TaskManager.getTotalTimeSpent(task.id)
      : task.actualTimeSpent;

    if (totalTime > 0) {
      parts.push(`⏱️ ${formatDuration(totalTime)}`);
    }
  }

  // Estimated duration
  if (task.estimatedDuration) {
    parts.push(`Est: ${formatDuration(task.estimatedDuration)}`);
  }

  if (parts.length > 0) {
    timeDiv.textContent = parts.join(' | ');
    return timeDiv;
  }

  return null;
}

/**
 * Create TMT metrics display
 * @param {Object} task - Task object
 * @returns {HTMLElement} Metrics element
 */
function createMetricsDisplay(task) {
  const metrics = document.createElement('div');
  metrics.className = 'detail-item metrics-display';

  const expectancyBar = createMetricBar('Expectancy', task.expectancy, '💪');
  const valueBar = createMetricBar('Value', task.value, '⭐');
  const impulsivityBar = createMetricBar('Impulsivity', task.impulsivity, '🎯', true);

  metrics.appendChild(expectancyBar);
  metrics.appendChild(valueBar);
  metrics.appendChild(impulsivityBar);

  return metrics;
}

/**
 * Create metric bar
 * @param {string} label - Metric label
 * @param {number} value - Metric value (0-10)
 * @param {string} icon - Icon
 * @param {boolean} inverse - Inverse color scale
 * @returns {HTMLElement} Metric bar element
 */
function createMetricBar(label, value, icon, inverse = false) {
  const container = document.createElement('div');
  container.className = 'metric-bar';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'metric-label';
  labelDiv.textContent = `${icon} ${label}`;

  const barBg = document.createElement('div');
  barBg.className = 'metric-bar-bg';

  const barFill = document.createElement('div');
  barFill.className = 'metric-bar-fill';
  barFill.style.width = `${(value / 10) * 100}%`;

  // Color based on value
  const colorValue = inverse ? 10 - value : value;
  if (colorValue >= 7) {
    barFill.style.backgroundColor = '#4caf50'; // Green
  } else if (colorValue >= 4) {
    barFill.style.backgroundColor = '#ff9800'; // Orange
  } else {
    barFill.style.backgroundColor = '#f44336'; // Red
  }

  const valueDiv = document.createElement('div');
  valueDiv.className = 'metric-value';
  valueDiv.textContent = value.toFixed(1);

  barBg.appendChild(barFill);

  container.appendChild(labelDiv);
  container.appendChild(barBg);
  container.appendChild(valueDiv);

  return container;
}

/**
 * Create task action buttons
 * @param {Object} task - Task object
 * @param {number} index - Task index
 * @returns {HTMLElement} Actions container
 */
function createTaskActions(task, index) {
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  // Start/Pause/Resume button
  if (task.status === 'pending' || task.status === 'paused') {
    const startBtn = document.createElement('button');
    startBtn.className = 'action-btn start-btn';
    startBtn.textContent = task.status === 'paused' ? 'Resume' : 'Start';
    startBtn.addEventListener('click', () => {
      if (window.handleStartTask) {
        window.handleStartTask(task.id);
      }
    });
    actions.appendChild(startBtn);
  } else if (task.status === 'started') {
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'action-btn pause-btn';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => {
      if (window.handlePauseTask) {
        window.handlePauseTask(task.id);
      }
    });
    actions.appendChild(pauseBtn);
  }

  // Focus button (if not completed/abandoned)
  if (task.status !== 'completed' && task.status !== 'abandoned') {
    const focusBtn = document.createElement('button');
    focusBtn.className = 'action-btn focus-btn';
    focusBtn.textContent = '🎯 Focus';
    focusBtn.addEventListener('click', () => {
      if (window.handleFocusMode) {
        window.handleFocusMode(task.id);
      }
    });
    actions.appendChild(focusBtn);
  }

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => {
    if (window.handleEditTask) {
      window.handleEditTask(task.id);
    }
  });
  actions.appendChild(editBtn);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (window.handleDeleteTask) {
      window.handleDeleteTask(task.id, index);
    }
  });
  actions.appendChild(deleteBtn);

  return actions;
}

/**
 * Show create task modal
 * @param {Function} onSubmit - Submit callback
 */
function showCreateModal(onSubmit) {
  if (!elements.taskModal) return;

  // Reset modal for create mode
  if (elements.modalTitle) {
    elements.modalTitle.textContent = 'New Task';
  }
  if (elements.createBtn) {
    elements.createBtn.textContent = 'Create';
  }

  // Clear form
  resetTaskForm();

  // Show modal
  elements.taskModal.classList.add('open');
  elements.taskModal.setAttribute('aria-hidden', 'false');

  // Focus first input
  if (elements.modalTaskName) {
    setTimeout(() => elements.modalTaskName.focus(), 100);
  }

  // Set submit callback
  if (onSubmit) {
    window.__taskModalSubmitCallback = onSubmit;
  }
}

/**
 * Show edit task modal
 * @param {Object} task - Task to edit
 * @param {Function} onSubmit - Submit callback
 */
function showEditModal(task, onSubmit) {
  if (!elements.taskModal) return;

  // Set modal for edit mode
  if (elements.modalTitle) {
    elements.modalTitle.textContent = 'Edit Task';
  }
  if (elements.createBtn) {
    elements.createBtn.textContent = 'Save Changes';
  }

  // Populate form with task data
  if (elements.modalTaskName) elements.modalTaskName.value = task.text || '';
  if (elements.deadlineDate) elements.deadlineDate.value = task.deadlineDate || '';
  if (elements.deadlineTime) elements.deadlineTime.value = task.deadlineTime || '';
  if (elements.category) elements.category.value = task.category || 'personal';

  // Estimated duration (hours and minutes)
  if (task.estimatedDuration) {
    const hours = Math.floor(task.estimatedDuration / 60);
    const minutes = task.estimatedDuration % 60;
    if (elements.durationHours) elements.durationHours.value = hours;
    if (elements.durationMinutes) elements.durationMinutes.value = minutes;
  }

  // Note: TMT values are now calculated automatically from behavior, not user input

  // Show modal
  elements.taskModal.classList.add('open');
  elements.taskModal.setAttribute('aria-hidden', 'false');

  // Focus first input
  if (elements.modalTaskName) {
    setTimeout(() => elements.modalTaskName.select(), 100);
  }

  // Set submit callback with task ID
  if (onSubmit) {
    window.__taskModalSubmitCallback = () => onSubmit(task.id);
  }
}

/**
 * Hide task modal
 */
function hideTaskModal() {
  if (!elements.taskModal) return;

  elements.taskModal.classList.remove('open');
  elements.taskModal.setAttribute('aria-hidden', 'true');

  // Clear callback
  window.__taskModalSubmitCallback = null;
}

/**
 * Reset task form
 */
function resetTaskForm() {
  if (elements.modalTaskName) elements.modalTaskName.value = '';
  if (elements.deadlineDate) elements.deadlineDate.value = '';
  if (elements.deadlineTime) elements.deadlineTime.value = '';
  if (elements.category) elements.category.value = 'personal';
  if (elements.durationHours) elements.durationHours.value = '0';
  if (elements.durationMinutes) elements.durationMinutes.value = '0';
  if (elements.expectancy) elements.expectancy.value = '5';
  if (elements.valueInput) elements.valueInput.value = '5';
  if (elements.impulsivity) elements.impulsivity.value = '5';

  // Clear errors
  const errorElements = document.querySelectorAll('.field-error');
  errorElements.forEach(el => el.textContent = '');
}

/**
 * Update timer display
 * @param {number} minutes - Minutes remaining
 * @param {number} seconds - Seconds remaining
 * @param {Object} timerState - Timer state object
 */
function updateTimerDisplay(minutes, seconds, timerState) {
  if (!elements.timerMinutes) return;

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (elements.timerMinutes) {
    elements.timerMinutes.textContent = formatted;
  }

  if (elements.timerStatus && timerState) {
    const statusText = timerState.isBreak ? 'Break Time' : 'Focus Session';
    elements.timerStatus.textContent = statusText;
  }

  // Update progress bar
  if (elements.timerProgress && timerState) {
    const totalSeconds = timerState.duration * 60;
    const elapsed = totalSeconds - timerState.remainingTime;
    const progress = (elapsed / totalSeconds) * 100;
    elements.timerProgress.style.width = `${progress}%`;
  }
}

/**
 * Show timer UI
 * @param {string} taskId - Task ID
 */
function showTimerUI(taskId) {
  if (!elements.timerContainer) return;

  elements.timerContainer.classList.add('active');

  // Set task info
  if (window.TaskManager) {
    const task = window.TaskManager.getTaskById(taskId);
    if (task && elements.timerTaskName) {
      elements.timerTaskName.textContent = task.text;
    }
  }
}

/**
 * Hide timer UI
 */
function hideTimerUI() {
  if (!elements.timerContainer) {
    return;
  }

  elements.timerContainer.classList.remove('active');
}

/**
 * Format duration (minutes to human-readable)
 * @param {number} minutes - Minutes
 * @returns {string} Formatted duration
 */
function formatDuration(minutes) {
  if (!minutes || minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Export API
if (typeof window !== 'undefined') {
  window.UIManager = {
    initUI,
    renderTaskList,
    showCreateModal,
    showEditModal,
    hideTaskModal,
    updateTimerDisplay,
    showTimerUI,
    hideTimerUI
  };
}
