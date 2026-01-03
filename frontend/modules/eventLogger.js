/**
 * Event Logger Module
 * - IndexedDB event storage
 * - Anonymous user ID management
 * - Event logging API with PII validation
 * - Prepare for future backend sync
 */

const DB_NAME = 'procrastination_prevention_db';
const DB_VERSION = 1;
const EVENT_STORE = 'events';
const SETTINGS_STORE = 'user_settings';

// Allowed event types (validation)
const ALLOWED_EVENT_TYPES = [
  'task_created',
  'task_started',
  'task_paused',
  'task_resumed',
  'task_completed',
  'task_abandoned',
  'task_deleted',
  'task_edited',
  'postpone_clicked',
  'focus_session_started',
  'focus_session_ended',
  'focus_session_break_started',
  'focus_session_break_ended',
  'app_backgrounded',
  'app_foregrounded',
  'reminder_dismissed',
  'session_recovered'
];

// Blacklisted metadata keys (PII protection)
const BLACKLISTED_KEYS = ['text', 'name', 'email', 'title', 'description', 'username', 'password'];
const API_URL = 'http://localhost:8000/api/v1/events';

let db = null;
let userId = null;
let syncInterval = null;

/**
 * Initialize IndexedDB and generate/retrieve user ID
 * Must be called before any other functions
 */
async function initEventLogger() {
  try {
    // Open/create database
    db = await openDatabase();

    // Get or create anonymous user ID
    userId = await getUserId();

    // Run cleanup on old events
    await cleanupOldEvents(90); // Keep 90 days

    // Start background sync
    startSyncInterval();

    console.log('[EventLogger] Initialized with user ID:', userId);
    return { success: true, userId };
  } catch (error) {
    console.error('[EventLogger] Initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start background synchronization
 */
function startSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);
  
  // Try to sync immediately on startup
  setTimeout(syncEvents, 5000);
  
  // Sync every 30 seconds
  syncInterval = setInterval(syncEvents, 30000);
}

/**
 * Sync offline events to backend
 */
async function syncEvents() {
  if (!db || !userId) return;

  try {
    const unsyncedEvents = await getUnsyncedEvents();
    if (unsyncedEvents.length === 0) return;

    console.log(`[EventLogger] Syncing ${unsyncedEvents.length} events...`);

    // Process in chunks of 50 to avoid timeouts
    const chunks = [];
    for (let i = 0; i < unsyncedEvents.length; i += 50) {
      chunks.push(unsyncedEvents.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      // Send each event individually for now (bulk endpoint would be better)
      // or parallelize with Promise.all
      await Promise.all(chunk.map(async (event) => {
        try {
          const payload = {
            event_type: event.event_type,
            data: event.metadata,
            timestamp: new Date(event.timestamp).getTime(), // Convert ISO to ms
            user_id: event.user_id
          };

          const response = await fetch(API_URL + '/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await markEventSynced(event.id);
          }
        } catch (e) {
          // Ignore network errors, will retry next time
        }
      }));
    }
  } catch (error) {
    console.error('[EventLogger] Sync failed:', error);
  }
}

/**
 * Get unsynced events from IndexedDB
 */
async function getUnsyncedEvents() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readonly');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.openCursor();
    const events = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (!cursor.value.synced) {
          events.push(cursor.value);
        }
        cursor.continue();
      } else {
        resolve(events);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark event as synced in IndexedDB
 */
async function markEventSynced(eventId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.get(eventId);

    request.onsuccess = () => {
      const event = request.result;
      if (event) {
        event.synced = true;
        store.put(event);
        resolve();
      } else {
        resolve(); // Event not found?
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Open IndexedDB connection
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create events object store
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        const eventStore = database.createObjectStore(EVENT_STORE, { keyPath: 'id' });
        eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        eventStore.createIndex('event_type', 'event_type', { unique: false });
        eventStore.createIndex('user_id', 'user_id', { unique: false });
      }

      // Create settings object store
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get or create anonymous user ID
 */
async function getUserId() {
  if (userId) return userId;

  try {
    const transaction = db.transaction([SETTINGS_STORE], 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);

    // Try to get existing user ID
    const getRequest = store.get('user_id');

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        if (getRequest.result && getRequest.result.value) {
          // User ID exists
          userId = getRequest.result.value;
          resolve(userId);
        } else {
          // Generate new user ID
          const newUserId = generateUUID();
          const putRequest = store.put({ key: 'user_id', value: newUserId });

          putRequest.onsuccess = () => {
            userId = newUserId;
            console.log('[EventLogger] Generated new user ID:', userId);
            resolve(userId);
          };

          putRequest.onerror = () => {
            reject(new Error('Failed to save user ID'));
          };
        }
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to retrieve user ID'));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error getting user ID:', error);
    throw error;
  }
}

/**
 * Generate a UUID v4 (utility function)
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Log an event to IndexedDB
 * @param {string} eventType - Type of event (must be in ALLOWED_EVENT_TYPES)
 * @param {Object} metadata - Event metadata (must not contain PII)
 * @returns {Promise<Object>} Result object with success status
 */
async function logEvent(eventType, metadata = {}) {
  if (!db || !userId) {
    console.warn('[EventLogger] Not initialized. Call initEventLogger() first.');
    return { success: false, error: 'EventLogger not initialized' };
  }

  // Validate event type
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    console.warn(`[EventLogger] Invalid event type: ${eventType}`);
    return { success: false, error: `Invalid event type: ${eventType}` };
  }

  // Validate metadata doesn't contain PII
  if (!validateNoPII(metadata)) {
    console.error('[EventLogger] Rejected event with PII in metadata');
    return { success: false, error: 'Metadata contains forbidden keys (PII)' };
  }

  try {
    const event = {
      id: generateUUID(),
      user_id: userId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
      synced: false // For future backend sync
    };

    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.add(event);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log(`[EventLogger] Logged event: ${eventType}`, metadata);
        resolve({ success: true, eventId: event.id });
      };

      request.onerror = () => {
        console.error('[EventLogger] Failed to log event:', request.error);
        reject(new Error('Failed to log event'));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error logging event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate that metadata doesn't contain PII
 * @param {Object} metadata - Metadata to validate
 * @returns {boolean} True if valid, false if contains PII
 */
function validateNoPII(metadata) {
  if (!metadata || typeof metadata !== 'object') return true;

  const keys = Object.keys(metadata);
  for (const key of keys) {
    if (BLACKLISTED_KEYS.includes(key.toLowerCase())) {
      console.warn(`[EventLogger] Rejected metadata with forbidden key: ${key}`);
      return false;
    }
  }
  return true;
}

/**
 * Get events from IndexedDB with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.eventType - Filter by event type
 * @param {Date} filters.startDate - Filter events after this date
 * @param {Date} filters.endDate - Filter events before this date
 * @param {number} filters.limit - Limit number of results
 * @returns {Promise<Array>} Array of events
 */
async function getEvents(filters = {}) {
  if (!db) {
    throw new Error('EventLogger not initialized');
  }

  try {
    const transaction = db.transaction([EVENT_STORE], 'readonly');
    const store = transaction.objectStore(EVENT_STORE);

    let request;
    if (filters.eventType) {
      const index = store.index('event_type');
      request = index.getAll(filters.eventType);
    } else {
      request = store.getAll();
    }

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        let events = request.result || [];

        // Apply date filters
        if (filters.startDate) {
          events = events.filter(e => new Date(e.timestamp) >= filters.startDate);
        }
        if (filters.endDate) {
          events = events.filter(e => new Date(e.timestamp) <= filters.endDate);
        }

        // Apply limit
        if (filters.limit) {
          events = events.slice(0, filters.limit);
        }

        resolve(events);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve events'));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error getting events:', error);
    throw error;
  }
}

/**
 * Get event count by type
 * @returns {Promise<Object>} Object with event type counts
 */
async function getEventStats() {
  if (!db) {
    throw new Error('EventLogger not initialized');
  }

  try {
    const events = await getEvents();
    const stats = {};

    events.forEach(event => {
      stats[event.event_type] = (stats[event.event_type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[EventLogger] Error getting event stats:', error);
    throw error;
  }
}

/**
 * Clean up old events (auto-cleanup to prevent quota issues)
 * @param {number} daysToKeep - Number of days to keep events
 */
async function cleanupOldEvents(daysToKeep = 90) {
  if (!db) return;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const index = store.index('timestamp');

    const range = IDBKeyRange.upperBound(cutoffTimestamp);
    const request = index.openCursor(range);

    let deletedCount = 0;

    return new Promise((resolve) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            console.log(`[EventLogger] Cleaned up ${deletedCount} old events`);
          }
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[EventLogger] Error cleaning up events');
        resolve(0);
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error in cleanup:', error);
  }
}

/**
 * Clear all events (for testing/debugging)
 * WARNING: This will delete all logged events
 */
async function clearAllEvents() {
  if (!db) {
    throw new Error('EventLogger not initialized');
  }

  try {
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.warn('[EventLogger] All events cleared');
        resolve({ success: true });
      };

      request.onerror = () => {
        reject(new Error('Failed to clear events'));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error clearing events:', error);
    throw error;
  }
}

/**
 * Get a setting from IndexedDB
 * @param {string} key - Setting key
 * @param {any} defaultValue - Default value if setting doesn't exist
 */
async function getSetting(key, defaultValue = null) {
  if (!db) {
    throw new Error('EventLogger not initialized');
  }

  try {
    const transaction = db.transaction([SETTINGS_STORE], 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get setting: ${key}`));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error getting setting:', error);
    return defaultValue;
  }
}

/**
 * Save a setting to IndexedDB
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 */
async function saveSetting(key, value) {
  if (!db) {
    throw new Error('EventLogger not initialized');
  }

  try {
    const transaction = db.transaction([SETTINGS_STORE], 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put({ key, value });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve({ success: true });
      };

      request.onerror = () => {
        reject(new Error(`Failed to save setting: ${key}`));
      };
    });
  } catch (error) {
    console.error('[EventLogger] Error saving setting:', error);
    throw error;
  }
}

// Export API
if (typeof window !== 'undefined') {
  window.EventLogger = {
    initEventLogger,
    logEvent,
    getEvents,
    getEventStats,
    cleanupOldEvents,
    clearAllEvents,
    getSetting,
    saveSetting,
    syncEvents, // Exported for manual sync
    getUserId: () => userId
  };
}
