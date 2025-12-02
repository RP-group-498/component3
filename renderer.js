const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');

let tasks = [];

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
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

    const span = document.createElement('div');
    span.className = 'task-text' + (t.done ? ' completed' : '');
    span.textContent = t.text;

    left.appendChild(chk);
    left.appendChild(span);

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

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.unshift({ text, done: false, created: Date.now() });
  taskInput.value = '';
  saveTasks();
  render();
}

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
  const newText = prompt('Edit task', tasks[idx].text);
  if (newText === null) return;
  tasks[idx].text = newText.trim() || tasks[idx].text;
  saveTasks();
  render();
}

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

// initialize
loadTasks();
render();
