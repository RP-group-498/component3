const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Intervention UI Demo',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Tray Management
 */
function createTray() {
  // Use a simple template icon or a placeholder
  const icon = nativeImage.createEmpty(); 
  tray = new Tray(icon);
  tray.setToolTip('Intervention UI Demo');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
}

ipcMain.on('tray:update-timer', (event, { label }) => {
  if (tray) {
    // On macOS, setTitle shows text next to the icon in the menu bar
    if (process.platform === 'darwin') {
      tray.setTitle(label);
    }
    tray.setToolTip(`Pomodoro: ${label}`);
  }
});

ipcMain.on('tray:clear', () => {
  if (tray) {
    tray.setTitle('');
    tray.setToolTip('Intervention UI Demo');
  }
});

ipcMain.on('window:show', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

/**
 * IPC Handler: Show System Notification with Actions
 */
ipcMain.on('notify:intervention-actions', (event, { title, body, strategy }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      silent: false,
      actions: [
        { type: 'button', text: 'Start' },
        { type: 'button', text: 'Skip' },
        { type: 'button', text: 'Not now' }
      ]
    });

    let actionTaken = false;

    const handleAction = (action) => {
      if (actionTaken) return;
      actionTaken = true;
      clearTimeout(autoCloseTimeout);
      event.reply('notification-action-response', { strategy, action });
    };

    notification.on('action', (e, index) => {
      const actions = ['start', 'skip', 'reject'];
      handleAction(actions[index]);
    });

    notification.on('click', () => {
      handleAction('start');
    });

    notification.on('close', () => {
      handleAction('skip');
    });

    notification.show();

    // Auto-close after 15 seconds
    const autoCloseTimeout = setTimeout(() => {
      if (!actionTaken) {
        notification.close();
        handleAction('skip');
      }
    }, 15000);
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
