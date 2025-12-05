const { ipcRenderer } = require('electron');
const modalTaskName = document.getElementById('modalTaskName');
const deadlineDate = document.getElementById('deadlineDate');
const deadlineTime = document.getElementById('deadlineTime');
const category = document.getElementById('category');
const expectancy = document.getElementById('expectancy');
const valueInput = document.getElementById('value');
const impulsivity = document.getElementById('impulsivity');
const delayDisplay = document.getElementById('delayDisplay');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const createBtn = document.getElementById('createBtn');
const cancelBtn = document.getElementById('cancelBtn');

let tasks = [];

// Update slider visuals
expectancy.addEventListener('input', (e) => updateSliderColor(expectancy, e.target.value));
valueInput.addEventListener('input', (e) => updateSliderColor(valueInput, e.target.value));
impulsivity.addEventListener('input', (e) => updateSliderColor(impulsivity, e.target.value, true));

// Calculate delay when deadline changes
function updateDelay() {
  if (!deadlineDate.value) {
    delayDisplay.textContent = 'Set a deadline above';
    delayDisplay.className = 'delay-value';
    return null;
  }

  const deadline = new Date(deadlineDate.value);
  if (deadlineTime.value) {
    const [hours, minutes] = deadlineTime.value.split(':');
    deadline.setHours(parseInt(hours), parseInt(minutes));
  }

  const now = new Date();
  const diffMs = deadline - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    delayDisplay.textContent = '⚠️ Overdue!';
    delayDisplay.className = 'delay-value overdue';
    return 0;
  } else if (diffDays < 1) {
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffHours - hours) * 60);
    delayDisplay.textContent = `${hours}h ${minutes}m remaining`;
    delayDisplay.className = 'delay-value urgent';
  } else if (diffDays < 7) {
    delayDisplay.textContent = `${diffDays.toFixed(1)} days remaining`;
    delayDisplay.className = 'delay-value soon';
  } else {
    delayDisplay.textContent = `${Math.round(diffDays)} days remaining`;
    delayDisplay.className = 'delay-value normal';
  }

  return diffDays;
}

function updateSliderColor(slider, value, inverse = false) {
  const percent = (value / slider.max) * 100;
  let color;
  
  if (inverse) {
    // For impulsivity, lower is better
    if (value <= 3) color = '#10b981';
    else if (value <= 7) color = '#f59e0b';
    else color = '#ef4444';
  } else {
    // For expectancy and value, higher is better
    if (value <= 3) color = '#ef4444';
    else if (value <= 7) color = '#f59e0b';
    else color = '#10b981';
  }
  
  slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #e5e7eb ${percent}%, #e5e7eb 100%)`;
}


deadlineDate.addEventListener('change', updateDelay);
deadlineTime.addEventListener('change', updateDelay);

const modal = document.getElementById('taskModal');
const formErrors = document.getElementById('formError');

// Initialize slider colors
updateSliderColor(expectancy, expectancy.value || 5);
updateSliderColor(valueInput, valueInput.value || 5);
updateSliderColor(impulsivity, impulsivity.value || 5, true);

// Form validation: inline messages and enable/disable Create button
function validateForm() {
  const errors = [];
  const name = modalTaskName.value.trim();
  if (!name) errors.push({ field: 'modalTaskName', msg: 'Task name is required' });
  if (!deadlineDate.value) errors.push({ field: 'deadlineDate', msg: 'Deadline date is required' });
  if (!deadlineTime.value) errors.push({ field: 'deadlineTime', msg: 'Deadline time is required' });
  if (!category.value) errors.push({ field: 'category', msg: 'Category is required' });
  const eVal = parseFloat(expectancy.value);
  const vVal = parseFloat(valueInput.value);
  const iVal = parseFloat(impulsivity.value);
  if (isNaN(eVal)) errors.push({ field: 'expectancy', msg: 'Set expectancy' });
  if (isNaN(vVal)) errors.push({ field: 'value', msg: 'Set value' });
  if (isNaN(iVal)) errors.push({ field: 'impulsivity', msg: 'Set impulsivity' });
  // clear previous error highlights
  ['modalTaskName','deadlineDate','deadlineTime','category','expectancy','value','impulsivity'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('input-error');
  });

  // clear field error texts
  ['nameError','dateError','timeError','categoryError','formError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  if (errors.length) {
    formErrors.innerHTML = errors.map(e => `<div class="err">• ${e.msg}</div>`).join('');
    // highlight fields
    errors.forEach(e => {
      const el = document.getElementById(e.field);
      if (el) el.classList.add('input-error');
      // show small inline field errors when available
      if (e.field === 'modalTaskName') {
        const ne = document.getElementById('nameError'); if (ne) ne.textContent = e.msg;
      }
      if (e.field === 'deadlineDate') {
        const de = document.getElementById('dateError'); if (de) de.textContent = e.msg;
      }
      if (e.field === 'deadlineTime') {
        const te = document.getElementById('timeError'); if (te) te.textContent = e.msg;
      }
      if (e.field === 'category') {
        const ce = document.getElementById('categoryError'); if (ce) ce.textContent = e.msg;
      }
    });
    createBtn.disabled = true;
  } else {
    formErrors.innerHTML = '';
    createBtn.disabled = false;
  }

  return errors;
}

// wire validation to input events for immediate feedback
[modalTaskName, deadlineDate, deadlineTime, category, expectancy, valueInput, impulsivity].forEach(el => {
  if (!el) return;
  el.addEventListener('input', validateForm);
  el.addEventListener('change', validateForm);
});

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  // inform main process about tasks so it can schedule system notifications
  try { ipcRenderer.send('notify:tasks', tasks); } catch (e) { /* ignore if ipc not available */ }
}

function loadTasks() {
  const raw = localStorage.getItem('tasks');
  tasks = raw ? JSON.parse(raw) : [];
}

function render() {
  taskList.innerHTML = '';
  tasks.forEach((t, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const left = document.createElement('div');
    left.className = 'task-left';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!t.done;
    chk.addEventListener('change', () => toggleDone(idx));

    const content = document.createElement('div');
    content.className = 'task-content';

    const titleRow = document.createElement('div');
    titleRow.className = 'task-title-row';

    const span = document.createElement('div');
    span.className = 'task-text' + (t.done ? ' completed' : '');
    span.textContent = t.text;

    const categoryBadge = document.createElement('span');
    categoryBadge.className = `category-badge ${t.category}`;
    categoryBadge.textContent = t.category;

    titleRow.appendChild(span);
    titleRow.appendChild(categoryBadge);

    const details = document.createElement('div');
    details.className = 'task-details';

    if (t.deadlineDate) {
      const deadline = document.createElement('div');
      deadline.className = 'detail-item';
      deadline.textContent = `📅 ${t.deadlineDate}${t.deadlineTime ? ' ' + t.deadlineTime : ''}`;
      details.appendChild(deadline);
    }

    const metrics = document.createElement('div');
    metrics.className = 'detail-item metrics-display';
    
    const expectancyBar = createMetricBar('Expectancy', t.expectancy, '💪');
    const valueBar = createMetricBar('Value', t.value, '⭐');
    const impulsivityBar = createMetricBar('Impulsivity', t.impulsivity, '🎯', true);
    
    metrics.appendChild(expectancyBar);
    metrics.appendChild(valueBar);
    metrics.appendChild(impulsivityBar);
    
    details.appendChild(metrics);

    content.appendChild(titleRow);
    content.appendChild(details);

    left.appendChild(chk);
    left.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'small-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editTask(idx));

    const delBtn = document.createElement('button');
    delBtn.className = 'small-btn delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteTask(idx));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);
    taskList.appendChild(li);
  });
}

function createMetricBar(label, value, icon, inverse = false) {
  const container = document.createElement('div');
  container.className = 'metric-bar-container';
  
  const labelEl = document.createElement('div');
  labelEl.className = 'metric-label';
  labelEl.textContent = `${icon} ${label}: ${value}`;
  
  const barBg = document.createElement('div');
  barBg.className = 'metric-bar-bg';
  
  const barFill = document.createElement('div');
  barFill.className = 'metric-bar-fill';
  barFill.style.width = `${(value / 10) * 100}%`;
  
  // Color based on value
  if (inverse) {
    if (value <= 3) barFill.style.background = '#10b981';
    else if (value <= 7) barFill.style.background = '#f59e0b';
    else barFill.style.background = '#ef4444';
  } else {
    if (value <= 3) barFill.style.background = '#ef4444';
    else if (value <= 7) barFill.style.background = '#f59e0b';
    else barFill.style.background = '#10b981';
  }
  
  barBg.appendChild(barFill);
  container.appendChild(labelEl);
  container.appendChild(barBg);
  
  return container;
}

function addTask() {
  const text = modalTaskName.value.trim();
  if (!text) {
    // shouldn't happen because validateForm prevents this, but guard anyway
    const ne = document.getElementById('nameError'); if (ne) ne.textContent = 'Task name is required';
    return;
  }
  
  const calculatedDelay = updateDelay();
  
  const task = {
    text,
    deadlineDate: deadlineDate.value,
    deadlineTime: deadlineTime.value,
    category: category.value,
    expectancy: parseFloat(expectancy.value),
    value: parseFloat(valueInput.value),
    impulsivity: parseFloat(impulsivity.value),
    delay: calculatedDelay !== null ? calculatedDelay : 999,
    // track when we last notified about this task so we can repeat every minute
    lastNotified: null,
    done: false,
    created: Date.now()
  };
  
  tasks.unshift(task);
  
  // Reset form (modal inputs)
  modalTaskName.value = '';
  deadlineDate.value = '';
  deadlineTime.value = '';
  category.value = 'personal';
  expectancy.value = '5';
  valueInput.value = '5';
  impulsivity.value = '5';
  delayDisplay.textContent = 'Set a deadline above';
  delayDisplay.className = 'delay-value';
  
  // Reset slider visuals
  updateSliderColor(expectancy, expectancy.value);
  updateSliderColor(valueInput, valueInput.value);
  updateSliderColor(impulsivity, impulsivity.value, true);
  
  saveTasks();
  render();
}

// Notification handling moved to the main process via IPC.
// The renderer informs the main process of the current tasks by calling ipcRenderer.send('notify:tasks', tasks)

function toggleDone(idx) {
  tasks[idx].done = !tasks[idx].done;
  saveTasks();
  render();
}

function deleteTask(idx) {
  if (!confirm('Delete this task?')) return;
  tasks.splice(idx, 1);
  saveTasks();
  render();
}

function editTask(idx) {
  const t = tasks[idx];
  const newText = prompt('Edit task name', t.text);
  if (newText === null) return;
  
  const newDeadline = prompt('Edit deadline (YYYY-MM-DD)', t.deadlineDate || '');
  const newTime = prompt('Edit time (HH:MM)', t.deadlineTime || '');
  const newCategory = prompt('Edit category (personal/uni/work)', t.category);
  const newExpectancy = prompt('Edit expectancy (0-10)', t.expectancy);
  const newValue = prompt('Edit value (0-10)', t.value);
  const newImpulsivity = prompt('Edit impulsivity (0-10)', t.impulsivity);
  const newDelay = prompt('Edit delay (days)', t.delay);
  
  if (newText.trim()) tasks[idx].text = newText.trim();
  if (newDeadline !== null) tasks[idx].deadlineDate = newDeadline;
  if (newTime !== null) tasks[idx].deadlineTime = newTime;
  if (newCategory) tasks[idx].category = newCategory;
  if (newExpectancy) tasks[idx].expectancy = parseFloat(newExpectancy);
  if (newValue) tasks[idx].value = parseFloat(newValue);
  if (newImpulsivity) tasks[idx].impulsivity = parseFloat(newImpulsivity);
  if (newDelay) tasks[idx].delay = parseFloat(newDelay);
  
  saveTasks();
  render();
}

// Open modal when Add is clicked
addBtn.addEventListener('click', () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  // clear previous errors and set initial state
  formErrors.innerHTML = '';
  createBtn.disabled = true;
  // focus name input
  if (modalTaskName) modalTaskName.focus();
  updateDelay();
});

// Create button validates all required fields and then adds the task
createBtn.addEventListener('click', () => {
  const errors = validateForm();
  if (errors.length) {
    const first = errors[0].field;
    const el = document.getElementById(first);
    if (el) el.focus();
    return;
  }

  // All good: compute delay and add
  updateDelay();
  addTask();

  // hide modal and reset
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  createBtn.disabled = true;
  formErrors.innerHTML = '';
});

// Cancel closes modal without creating
cancelBtn.addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  formErrors.innerHTML = '';
  createBtn.disabled = true;
});

// Enter behavior: if modal open, create; otherwise open modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (modal.classList.contains('open')) createBtn.click();
    else addBtn.click();
  }
});

// initialize
loadTasks();
render();
// inform main process about existing tasks for notification scheduling
try { ipcRenderer.send('notify:tasks', tasks); } catch (e) { }
