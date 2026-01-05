/**
 * UI Manager Module
 * - Task list rendering with status badges
 * - Modal management (create/edit)
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
    deadline.innerHTML = `<i data-lucide="calendar"></i> ${task.deadlineDate}${task.deadlineTime ? ' ' + task.deadlineTime : ''}`;
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

  // Subtasks section
  const subtasksSection = createSubtasksSection(task);
  if (subtasksSection) {
    content.appendChild(subtasksSection);
  }

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

  const expectancyBar = createMetricBar('Expectancy', task.expectancy, 'zap');
  const valueBar = createMetricBar('Value', task.value, 'star');
  const impulsivityBar = createMetricBar('Impulsivity', task.impulsivity, 'target', true);
  const delayBar = createMetricBar('Delay', task.delay, 'clock', true);

  metrics.appendChild(expectancyBar);
  metrics.appendChild(valueBar);
  metrics.appendChild(impulsivityBar);
  metrics.appendChild(delayBar);

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
  labelDiv.innerHTML = `<i data-lucide="${icon}"></i> ${label}`;

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
 * Create subtasks section
 * @param {Object} task - Task object
 * @returns {HTMLElement|null} Subtasks section
 */
function createSubtasksSection(task) {
  const container = document.createElement('div');
  container.className = 'subtasks-section';

  // Header with total estimated time and add button
  const header = document.createElement('div');
  header.className = 'subtasks-header';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'subtasks-title';

  // Calculate total estimated time from subtasks
  const totalMinutes = window.TaskManager
    ? window.TaskManager.calculateEstimatedDuration(task)
    : 0;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeStr = hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;

  titleDiv.innerHTML = `
    <span class="subtasks-label"><i data-lucide="list-checks"></i> Subtasks</span>
    <span class="subtasks-time">Est. Time: ${timeStr}</span>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = 'add-subtask-btn';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.handleAddSubtask) {
      window.handleAddSubtask(task.id);
    }
  });

  header.appendChild(titleDiv);
  header.appendChild(addBtn);

  container.appendChild(header);

  // Subtasks list
  if (task.subtasks && task.subtasks.length > 0) {
    const list = document.createElement('div');
    list.className = 'subtasks-list';

    task.subtasks.forEach((subtask) => {
      const item = createSubtaskItem(task.id, subtask);
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  return container;
}

/**
 * Create subtask item
 * @param {string} taskId - Parent task ID
 * @param {Object} subtask - Subtask object
 * @returns {HTMLElement} Subtask item
 */
function createSubtaskItem(taskId, subtask) {
  const item = document.createElement('div');
  item.className = 'subtask-item' + (subtask.done ? ' done' : '');

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'subtask-checkbox';
  checkbox.checked = subtask.done;
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    if (window.handleToggleSubtask) {
      window.handleToggleSubtask(taskId, subtask.id);
    }
  });

  // Text
  const text = document.createElement('span');
  text.className = 'subtask-text';
  text.textContent = subtask.text;

  // Time
  const time = document.createElement('span');
  time.className = 'subtask-time';
  const hours = Math.floor(subtask.estimatedDuration / 60);
  const minutes = subtask.estimatedDuration % 60;
  const timeStr = hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;
  time.textContent = timeStr;

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'subtask-delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete subtask';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete subtask "${subtask.text}"?`)) {
      if (window.handleDeleteSubtask) {
        window.handleDeleteSubtask(taskId, subtask.id);
      }
    }
  });

  item.appendChild(checkbox);
  item.appendChild(text);
  item.appendChild(time);
  item.appendChild(deleteBtn);

  return item;
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

/**
 * Aggregate motivation history from all tasks
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Sorted array of motivation data points
 */
function aggregateMotivationHistory(tasks) {
  const dataPoints = [];

  tasks.forEach(task => {
    if (task.tmtHistory && Array.isArray(task.tmtHistory)) {
      task.tmtHistory.forEach(entry => {
        if (entry.timestamp && typeof entry.motivation === 'number') {
          dataPoints.push({
            timestamp: entry.timestamp,
            motivation: entry.motivation,
            taskId: task.id,
            taskText: task.text
          });
        }
      });
    }
  });

  // Sort by timestamp (oldest to newest)
  dataPoints.sort((a, b) => a.timestamp - b.timestamp);

  return dataPoints;
}

/**
 * Calculate statistics from motivation data
 * @param {Array} dataPoints - Array of motivation data points
 * @returns {Object} Statistics object
 */
function calculateMotivationStats(dataPoints) {
  if (dataPoints.length === 0) {
    return {
      current: 0,
      average: 0,
      trend: 'neutral',
      sevenDayAvg: 0
    };
  }

  // Current motivation (most recent)
  const current = dataPoints[dataPoints.length - 1].motivation;

  // Overall average
  const sum = dataPoints.reduce((acc, point) => acc + point.motivation, 0);
  const average = sum / dataPoints.length;

  // 7-day average
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentPoints = dataPoints.filter(point => point.timestamp >= sevenDaysAgo);
  const sevenDayAvg = recentPoints.length > 0
    ? recentPoints.reduce((acc, point) => acc + point.motivation, 0) / recentPoints.length
    : 0;

  // Trend calculation (compare first half vs second half of recent data)
  let trend = 'neutral';
  if (recentPoints.length >= 4) {
    const midpoint = Math.floor(recentPoints.length / 2);
    const firstHalf = recentPoints.slice(0, midpoint);
    const secondHalf = recentPoints.slice(midpoint);

    const firstAvg = firstHalf.reduce((acc, p) => acc + p.motivation, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((acc, p) => acc + p.motivation, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    if (diff > 0.5) trend = 'up';
    else if (diff < -0.5) trend = 'down';
  }

  return {
    current: current.toFixed(1),
    average: average.toFixed(1),
    trend,
    sevenDayAvg: sevenDayAvg.toFixed(1)
  };
}

// Store chart instance globally to allow updates
let motivationChartInstance = null;

/**
 * Render motivation graph
 * @param {Array} tasks - Array of tasks
 */
function renderMotivationGraph(tasks) {
  const canvas = document.getElementById('motivationChart');
  if (!canvas) {
    console.warn('[UIManager] motivationChart canvas not found');
    return;
  }

  // === REAL DATA LOGIC (COMMENTED OUT FOR NOW) ===
  // Aggregate data from all tasks
  // const dataPoints = aggregateMotivationHistory(tasks);

  // Calculate statistics
  // const stats = calculateMotivationStats(dataPoints);

  // Update summary cards
  // updateSummaryCards(stats);

  // Prepare chart data
  // const labels = dataPoints.map(point => {
  //   const date = new Date(point.timestamp);
  //   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // });

  // const motivationData = dataPoints.map(point => point.motivation);
  // === END REAL DATA LOGIC ===

  // === HARDCODED SAMPLE DATA FOR TESTING ===
  // Generate sample data for the last 14 days
  const labels = [];
  const motivationData = [];
  const today = new Date();

  // Sample motivation values showing a trend
  const sampleValues = [4.2, 4.5, 5.1, 5.8, 6.2, 5.9, 6.5, 7.1, 6.8, 7.3, 7.8, 7.5, 8.1, 8.4];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    motivationData.push(sampleValues[13 - i]);
  }

  // Hardcoded statistics
  const stats = {
    current: '8.4',
    average: '6.5',
    trend: 'up',
    sevenDayAvg: '7.4'
  };

  // Update summary cards with hardcoded stats
  updateSummaryCards(stats);
  // === END HARDCODED DATA ===

  // Destroy previous chart if exists
  if (motivationChartInstance) {
    motivationChartInstance.destroy();
  }

  // Create new chart
  const ctx = canvas.getContext('2d');

  motivationChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Motivation Score',
        data: motivationData,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 12,
              weight: '600'
            },
            color: '#1f2937',
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13,
            weight: '600'
          },
          bodyFont: {
            size: 12
          },
          callbacks: {
            label: function(context) {
              return `Motivation: ${context.parsed.y.toFixed(1)}/10`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#6b7280'
          },
          title: {
            display: true,
            text: 'Motivation Score',
            font: {
              size: 12,
              weight: '600'
            },
            color: '#1f2937'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10
            },
            color: '#6b7280',
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    }
  });
}

/**
 * Update summary cards with statistics
 * @param {Object} stats - Statistics object
 */
function updateSummaryCards(stats) {
  const currentEl = document.getElementById('currentMotivation');
  const avgEl = document.getElementById('avgMotivation');
  const trendEl = document.getElementById('motivationTrend');

  if (currentEl) {
    currentEl.textContent = stats.current;
    // Apply color class based on value
    currentEl.className = 'summary-value';
    const currentVal = parseFloat(stats.current);
    if (currentVal >= 7) currentEl.classList.add('high');
    else if (currentVal >= 4) currentEl.classList.add('medium');
    else currentEl.classList.add('low');
  }

  if (avgEl) {
    avgEl.textContent = stats.sevenDayAvg;
    avgEl.className = 'summary-value';
    const avgVal = parseFloat(stats.sevenDayAvg);
    if (avgVal >= 7) avgEl.classList.add('high');
    else if (avgVal >= 4) avgEl.classList.add('medium');
    else avgEl.classList.add('low');
  }

  if (trendEl) {
    const trendIcons = {
      up: '↑ Improving',
      down: '↓ Declining',
      neutral: '→ Stable'
    };
    trendEl.textContent = trendIcons[stats.trend] || '→ Stable';
    trendEl.className = 'summary-value';
    if (stats.trend === 'up') trendEl.classList.add('high');
    else if (stats.trend === 'down') trendEl.classList.add('low');
    else trendEl.classList.add('medium');
  }
}

// Export API
if (typeof window !== 'undefined') {
  window.UIManager = {
    initUI,
    renderTaskList,
    showCreateModal,
    showEditModal,
    hideTaskModal,
    renderMotivationGraph
  };
}
