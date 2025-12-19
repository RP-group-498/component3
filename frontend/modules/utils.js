/**
 * Utility functions for the application
 * - UUID generation
 * - Time formatting
 * - Helper functions
 */

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID() if available, fallback to custom implementation
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format minutes into human-readable time string
 * @param {number} minutes - Number of minutes
 * @returns {string} Formatted time (e.g., "1h 30m", "45m", "2h")
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
 * Format timestamp to time string (HH:MM:SS format)
 * @param {number} seconds - Number of seconds
 * @returns {string} Formatted time (e.g., "01:23:45")
 */
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format timer display (MM:SS format)
 * @param {number} minutes - Number of minutes remaining
 * @param {number} seconds - Number of seconds remaining
 * @returns {string} Formatted timer (e.g., "25:00", "05:42")
 */
function formatTimer(minutes, seconds) {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Convert milliseconds to minutes
 * @param {number} ms - Milliseconds
 * @returns {number} Minutes (rounded to 2 decimal places)
 */
function msToMinutes(ms) {
  return Math.round((ms / 1000 / 60) * 100) / 100;
}

/**
 * Convert minutes to milliseconds
 * @param {number} minutes - Minutes
 * @returns {number} Milliseconds
 */
function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

/**
 * Get ISO-8601 timestamp string
 * @returns {string} ISO-8601 formatted timestamp
 */
function getISOTimestamp() {
  return new Date().toISOString();
}

/**
 * Calculate time remaining until deadline
 * @param {string} deadlineDate - Date string (YYYY-MM-DD)
 * @param {string} deadlineTime - Time string (HH:MM)
 * @returns {number} Minutes until deadline (negative if overdue)
 */
function calculateTimeUntilDeadline(deadlineDate, deadlineTime) {
  if (!deadlineDate) return Infinity;

  const deadline = new Date(deadlineDate);
  if (deadlineTime) {
    const [hours, minutes] = deadlineTime.split(':');
    deadline.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return msToMinutes(diff);
}

/**
 * Calculate delay in days for TMT formula
 * @param {string} deadlineDate - Date string (YYYY-MM-DD)
 * @param {string} deadlineTime - Time string (HH:MM)
 * @returns {number} Days until deadline
 */
function calculateDelay(deadlineDate, deadlineTime) {
  const minutesUntil = calculateTimeUntilDeadline(deadlineDate, deadlineTime);
  if (minutesUntil === Infinity) return Infinity;
  return Math.max(0, minutesUntil / (60 * 24));
}

/**
 * Debounce function - limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Validate that an object doesn't contain PII
 * @param {Object} metadata - Metadata object to validate
 * @param {Array<string>} blacklist - List of forbidden keys
 * @returns {boolean} True if valid, false if contains PII
 */
function validateNoPII(metadata, blacklist = ['text', 'name', 'email', 'title', 'description', 'user', 'username']) {
  if (!metadata || typeof metadata !== 'object') return true;

  const keys = Object.keys(metadata);
  for (const key of keys) {
    if (blacklist.includes(key.toLowerCase())) {
      console.warn(`Rejected metadata with forbidden key: ${key}`);
      return false;
    }
  }
  return true;
}

// Export all utility functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateUUID,
    formatDuration,
    formatTime,
    formatTimer,
    msToMinutes,
    minutesToMs,
    getISOTimestamp,
    calculateTimeUntilDeadline,
    calculateDelay,
    debounce,
    validateNoPII
  };
}
