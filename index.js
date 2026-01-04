const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { activeWindowAsync } = require('@miniben90/x-win');

let tray = null;
let mainWindow = null;

// Active window monitoring
let activeWindowMonitor = null;
let isTaskInProgress = false;
let currentTaskId = null;
let lastActiveApp = null;

// List of IDE identifiers (lowercase for matching)
const IDE_IDENTIFIERS = [
  'visual studio code',
  'vscode',
  'code',
  'intellij',
  'pycharm',
  'webstorm',
  'phpstorm',
  'rider',
  'goland',
  'clion',
  'datagrip',
  'rubymine',
  'appcode',
  'android studio',
  'eclipse',
  'netbeans',
  'sublime text',
  'atom',
  'vim',
  'neovim',
  'emacs',
  'xcode',
  'qt creator',
  'notepad++',
  'brackets',
  'geany',
  'kate',
  'gedit',
  'nano',
  'terminal', // Terminal can be for coding
  'iterm',
  'hyper',
  'alacritty',
  'warp'
];

// Browser identifiers (lowercase)
const BROWSER_IDENTIFIERS = [
  'chrome',
  'firefox',
  'safari',
  'edge',
  'brave',
  'opera',
  'vivaldi',
  'arc'
];

// Academic/Productive websites (domains and keywords)
const ACADEMIC_SITES = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',
  'hackerrank.com',
  'leetcode.com',
  'codewars.com',
  'codepen.io',
  'codesandbox.io',
  'replit.com',
  'kaggle.com',
  'coursera.org',
  'edx.org',
  'udemy.com',
  'udacity.com',
  'khanacademy.org',
  'brilliant.org',
  'freecodecamp.org',
  'w3schools.com',
  'mdn.mozilla.org',
  'developer.mozilla.org',
  'docs.python.org',
  'nodejs.org',
  'react.dev',
  'vuejs.org',
  'angular.io',
  'tensorflow.org',
  'pytorch.org',
  'arxiv.org',
  'scholar.google',
  'researchgate.net',
  'medium.com', // Can be both, but often technical
  'dev.to',
  'hashnode.com',
  'notion.so',
  'overleaf.com',
  'latex',
  'jupyter',
  'colab.research.google',
  'aws.amazon.com',
  'cloud.google.com',
  'azure.microsoft.com',
  'documentation',
  'docs.',
  'api.',
  'tutorial',
  'learning'
];

// Non-academic/Procrastinating websites
const NON_ACADEMIC_SITES = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'twitch.tv',
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',
  'spotify.com',
  'soundcloud.com',
  'pinterest.com',
  'tumblr.com',
  'snapchat.com',
  'whatsapp.com',
  'telegram.org',
  'discord.com', // Can be work-related but often social
  'slack.com', // Can be work-related
  'gaming',
  'game',
  'play',
  'news',
  'sports',
  'entertainment',
  'shopping',
  'amazon.com',
  'ebay.com',
  'etsy.com'
];

// Neutral websites (could be either productive or not)
const NEUTRAL_SITES = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'search',
  'mail',
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'calendar',
  'drive.google.com',
  'dropbox.com',
  'onedrive.com',
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'webex.com'
];

/**
 * Check if an app is a browser
 */
function isBrowser(appName) {
  if (!appName) return false;
  const lowerName = appName.toLowerCase();
  return BROWSER_IDENTIFIERS.some(browser => lowerName.includes(browser));
}

/**
 * Extract domain/keywords from window title
 * Browser titles usually contain: "Page Title - Domain - Browser Name"
 */
function extractDomainFromTitle(title) {
  if (!title) return '';

  const lowerTitle = title.toLowerCase();

  // Try to extract domain patterns
  // Common patterns: "Title - github.com", "github.com - Chrome", "GitHub - Chrome"
  const domainPatterns = [
    /https?:\/\/([^\s/]+)/i,  // Full URL
    /([a-z0-9-]+\.[a-z]{2,})/i  // Domain pattern
  ];

  for (const pattern of domainPatterns) {
    const match = lowerTitle.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return lowerTitle;
}

/**
 * Classify website as academic, non-academic, or neutral
 * Returns: { type: 'academic' | 'non-academic' | 'neutral', confidence: number }
 */
function classifyWebsite(title) {
  const domain = extractDomainFromTitle(title);

  // Check academic sites
  for (const site of ACADEMIC_SITES) {
    if (domain.includes(site)) {
      return { type: 'academic', confidence: 1.0, site };
    }
  }

  // Check non-academic sites
  for (const site of NON_ACADEMIC_SITES) {
    if (domain.includes(site)) {
      return { type: 'non-academic', confidence: 1.0, site };
    }
  }

  // Check neutral sites
  for (const site of NEUTRAL_SITES) {
    if (domain.includes(site)) {
      return { type: 'neutral', confidence: 0.5, site };
    }
  }

  // Unknown - assume neutral
  return { type: 'neutral', confidence: 0.3, site: domain };
}

/**
 * Determine if user is working or procrastinating
 * Returns: { isWorking: boolean, category: string, detail: string }
 */
function analyzeActivity(appName, windowTitle) {
  const isIDEApp = isIDE(appName);
  const isBrowserApp = isBrowser(appName);

  if (isIDEApp) {
    // Using an IDE - definitely working
    return {
      isWorking: true,
      category: 'ide',
      detail: appName,
      confidence: 1.0
    };
  }

  if (isBrowserApp) {
    // Using browser - check the website
    const classification = classifyWebsite(windowTitle);

    if (classification.type === 'academic') {
      return {
        isWorking: true,
        category: 'academic-web',
        detail: classification.site,
        confidence: classification.confidence
      };
    } else if (classification.type === 'non-academic') {
      return {
        isWorking: false,
        category: 'procrastinating-web',
        detail: classification.site,
        confidence: classification.confidence
      };
    } else {
      // Neutral - give benefit of doubt (could be research)
      return {
        isWorking: true,
        category: 'neutral-web',
        detail: classification.site,
        confidence: classification.confidence
      };
    }
  }

  // Other apps - assume non-productive
  return {
    isWorking: false,
    category: 'other-app',
    detail: appName,
    confidence: 0.8
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
}

function createTray() {
  // Create a simple 16x16 transparent icon for the tray
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  // Set initial tooltip
  tray.setToolTip('Focus - No active timer');

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Click tray to show window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

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
          showMainNotification('Focus — deadline soon', `Deadline approaching: ${t.text} — ${Math.ceil(diff / 1000)}s`);
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

function showMainNotification(title, body, actions = null, metadata = null) {
  try {
    console.log('[Notification] Creating notification:', { title, actions, metadata });

    const notificationOptions = {
      title,
      body,
      silent: false,
      timeoutType: 'never' // Keep notification visible until user interacts
    };

    // Platform-specific action button support
    if (actions && Array.isArray(actions) && actions.length > 0) {
      if (process.platform === 'darwin') {
        // macOS: Use hasReply for better compatibility
        // Will show "Reply" button that opens app with action dialog
        notificationOptions.hasReply = true;
        notificationOptions.replyPlaceholder = actions.map(a => a.text).join(' / ');
        console.log('[Notification] macOS: Using hasReply with actions:', actions);
      } else {
        // Windows/Linux: Use action buttons directly
        notificationOptions.actions = actions;
        console.log('[Notification] Windows/Linux: Using actions:', actions);
      }
    }

    const n = new Notification(notificationOptions);

    // Handle notification click (body click)
    n.on('click', () => {
      console.log('[Notification] Notification body clicked');
      const w = BrowserWindow.getAllWindows()[0];
      if (w) {
        w.show();
        w.focus();

        // On click, show action dialog in app
        if (actions && metadata) {
          w.webContents.send('intervention-show-dialog', {
            actions: actions,
            metadata: metadata
          });
        }
      }
    });

    // Handle reply (macOS)
    n.on('reply', (event, reply) => {
      console.log('[Notification] Reply received:', reply);

      const w = BrowserWindow.getAllWindows()[0];
      if (w) {
        // Determine action based on reply text
        let actionType = 'accept';
        const replyLower = reply.toLowerCase();

        if (actions) {
          // Check if reply matches any action text
          for (const action of actions) {
            if (replyLower.includes(action.text.toLowerCase())) {
              actionType = action.type;
              break;
            }
          }

          // Common keywords for rejection
          if (replyLower.includes('skip') || replyLower.includes('no') ||
              replyLower.includes('later') || replyLower.includes('cancel')) {
            actionType = 'reject';
          }
        }

        console.log('[Notification] Resolved action:', actionType);

        w.webContents.send('intervention-action', {
          action: actionType,
          metadata: metadata,
          reply: reply
        });
        w.show();
        w.focus();
      }
    });

    // Handle action button clicks (Windows/Linux)
    n.on('action', (event, index) => {
      console.log(`[Notification] Action button clicked at index: ${index}`);

      // Safety check
      if (!actions || !actions[index]) {
        console.error('[Notification] Invalid action index:', index);
        return;
      }

      const selectedAction = actions[index];
      console.log('[Notification] Selected action:', selectedAction);

      const w = BrowserWindow.getAllWindows()[0];
      if (w) {
        // Send the action response back to renderer
        w.webContents.send('intervention-action', {
          action: selectedAction.type,
          metadata: metadata
        });
        w.show();
        w.focus();
      }
    });

    // Handle notification close
    n.on('close', () => {
      console.log('[Notification] Notification closed');
    });

    n.show();
    console.log('[Notification] Notification shown with platform:', process.platform);

  } catch (e) {
    console.error('[Notification] Error showing notification:', e);
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

ipcMain.on('notify:intervention', (event, { title, body, actions, metadata }) => {
  showMainNotification(title, body, actions, metadata);
});

// --- Active Window Monitoring for Procrastination Detection ----------------

/**
 * Check if an app is an IDE
 */
function isIDE(appName) {
  if (!appName) return false;
  const lowerName = appName.toLowerCase();
  return IDE_IDENTIFIERS.some(ide => lowerName.includes(ide));
}

/**
 * Start monitoring active window
 */
function startActiveWindowMonitoring(taskId) {
  console.log(`[ActiveWindow] Starting monitoring for task: ${taskId}`);

  currentTaskId = taskId;
  isTaskInProgress = true;
  lastActiveApp = null;

  // Stop existing monitor if any
  if (activeWindowMonitor) {
    clearInterval(activeWindowMonitor);
  }

  // Check active window every 10 seconds
  activeWindowMonitor = setInterval(async () => {
    try {
      const activeWin = await activeWindowAsync();

      if (!activeWin || !isTaskInProgress) {
        return;
      }

      const appName = activeWin.owner?.name || '';
      const windowTitle = activeWin.title || '';

      // Analyze activity (IDE, academic website, or procrastinating)
      const analysis = analyzeActivity(appName, windowTitle);

      // Send activity update to renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('active-window:update', {
          taskId: currentTaskId,
          appName: appName,
          windowTitle: windowTitle,
          isWorking: analysis.isWorking,
          category: analysis.category,
          detail: analysis.detail,
          confidence: analysis.confidence,
          isProcrastinating: !analysis.isWorking,
          timestamp: Date.now()
        });
      }

      // Log app switches
      const currentIdentifier = `${appName}|${windowTitle}`;
      if (lastActiveApp && lastActiveApp !== currentIdentifier) {
        const logMsg = analysis.category === 'academic-web'
          ? `${lastActiveApp.split('|')[0]} -> ${analysis.detail} (Academic)`
          : analysis.category === 'procrastinating-web'
            ? `${lastActiveApp.split('|')[0]} -> ${analysis.detail} (Procrastinating)`
            : analysis.category === 'ide'
              ? `${lastActiveApp.split('|')[0]} -> ${appName} (IDE)`
              : `${lastActiveApp.split('|')[0]} -> ${appName} (${analysis.category})`;

        console.log(`[ActiveWindow] ${logMsg}`);

        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('active-window:switch', {
            taskId: currentTaskId,
            from: lastActiveApp.split('|')[0],
            to: appName,
            toDetail: analysis.detail,
            toCategory: analysis.category,
            isWorking: analysis.isWorking,
            timestamp: Date.now()
          });
        }
      }

      lastActiveApp = currentIdentifier;

    } catch (error) {
      console.error('[ActiveWindow] Error getting active window:', error);
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Stop monitoring active window
 */
function stopActiveWindowMonitoring() {
  console.log('[ActiveWindow] Stopping monitoring');

  isTaskInProgress = false;
  currentTaskId = null;
  lastActiveApp = null;

  if (activeWindowMonitor) {
    clearInterval(activeWindowMonitor);
    activeWindowMonitor = null;
  }
}

// IPC handlers for task status changes
ipcMain.on('task:started', (event, taskId) => {
  console.log(`[Task] Started: ${taskId}`);
  startActiveWindowMonitoring(taskId);
});

ipcMain.on('task:paused', (event, taskId) => {
  console.log(`[Task] Paused: ${taskId}`);
  stopActiveWindowMonitoring();
});

ipcMain.on('task:stopped', (event, taskId) => {
  console.log(`[Task] Stopped: ${taskId}`);
  stopActiveWindowMonitoring();
});

ipcMain.on('task:completed', (event, taskId) => {
  console.log(`[Task] Completed: ${taskId}`);
  stopActiveWindowMonitoring();
});

app.on('window-all-closed', () => {
  stopActiveWindowMonitoring();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
