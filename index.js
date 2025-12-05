const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

// --- Notification service in main process ---------------------------------
let tasksForNotify = [];
let notifyTimer = null;
const CHECK_INTERVAL = 60 * 1000; // 1 minute
const NOTIFY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const NOTIFY_REPEAT_MS = 60 * 1000; // 1 minute
const lastNotified = new Map();

function startMainNotifier() {
  if (notifyTimer) return;
  notifyTimer = setInterval(() => {
    const now = Date.now();
    tasksForNotify.forEach((t) => {
      if (!t) return;
      if (t.done) return;
      if (!t.deadlineDate) return;
      // build deadline
      const d = new Date(t.deadlineDate);
      if (t.deadlineTime) {
        const [hh, mm] = ('' + t.deadlineTime).split(':');
        d.setHours(parseInt(hh || '0'), parseInt(mm || '0'));
      }
      const diff = d.getTime() - now;

      const id = t.created || (t.text + '_' + (t.deadlineDate || ''));
      const last = lastNotified.get(id) || 0;

      if (diff <= 0) {
        // overdue: notify once per threshold window
        if (now - last >= NOTIFY_THRESHOLD_MS) {
          showMainNotification('Focus — overdue', `Task "${t.text}" is overdue`);
          lastNotified.set(id, now);
        }
        return;
      }

      if (diff <= NOTIFY_THRESHOLD_MS) {
        if (now - last >= NOTIFY_REPEAT_MS) {
          showMainNotification('Focus — deadline soon', `Deadline approaching: ${t.text} — ${Math.ceil(diff/1000)}s`);
          lastNotified.set(id, now);
        }
      }
    });
  }, CHECK_INTERVAL);
}

function stopMainNotifier() {
  if (notifyTimer) {
    clearInterval(notifyTimer);
    notifyTimer = null;
  }
}

function showMainNotification(title, body) {
  try {
    const n = new Notification({ title, body });
    n.show();
    n.on('click', () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) w.show();
    });
  } catch (e) {
    console.warn('Main notification failed', e);
  }
}

ipcMain.on('notify:tasks', (event, tasks) => {
  try {
    tasksForNotify = Array.isArray(tasks) ? tasks : [];
    if (tasksForNotify.length) startMainNotifier(); else stopMainNotifier();
  } catch (e) {
    console.warn('notify:tasks error', e);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
