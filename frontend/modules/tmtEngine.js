/**
 * TMT (Temporal Motivation Theory) Engine
 * Computes TMT variables from implicit behavioral data
 * NO user questionnaires - all values derived from actions
 */

/**
 * Calculate Expectancy (belief in successful completion)
 * Based on: completion history, retry behavior, task size confidence
 * @param {Object} task - Current task
 * @param {Array} allTasks - All tasks for historical analysis
 * @returns {number} Expectancy score (0.0 to 1.0)
 */
function calculateExpectancy(task, allTasks) {
  // Factor 1: Completion History (40% weight)
  const tasksInCategory = allTasks.filter(t => t.category === task.category);
  const completedInCategory = tasksInCategory.filter(t => t.status === 'completed').length;
  const attemptedInCategory = tasksInCategory.filter(t =>
    t.status === 'completed' || t.status === 'abandoned'
  ).length;

  const completionHistory = attemptedInCategory > 0
    ? completedInCategory / attemptedInCategory
    : 0.5; // Neutral default

  // Factor 2: Retry Behavior (25% weight)
  // Lower retry count = higher expectancy
  const retryCount = task.retryCount || 0;
  const retryBehavior = 1 / (1 + retryCount);

  // Factor 3: Task Size Confidence (15% weight)
  // How close is this task's estimated duration to average?
  let taskSizeConfidence = 0.5; // Default neutral
  if (task.estimatedDuration && tasksInCategory.length > 0) {
    const durations = tasksInCategory
      .filter(t => t.estimatedDuration)
      .map(t => t.estimatedDuration);

    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      if (maxDuration > 0) {
        const deviation = Math.abs(task.estimatedDuration - avgDuration);
        taskSizeConfidence = 1 - Math.min(deviation / maxDuration, 1);
      }
    }
  }

  // Factor 4: Subtask Progress (20% weight)
  // Visible progress through completed subtasks increases expectancy
  let subtaskProgress = 0.5; // Default neutral (no subtasks)
  if (task.subtasks && task.subtasks.length > 0) {
    const completedSubtasks = task.subtasks.filter(st => st.done).length;
    const totalSubtasks = task.subtasks.length;
    subtaskProgress = completedSubtasks / totalSubtasks;

    // Boost: Even partial progress (>0%) increases expectancy
    // 0% → 0.3, 25% → 0.5, 50% → 0.7, 75% → 0.85, 100% → 1.0
    if (completedSubtasks > 0) {
      subtaskProgress = 0.3 + (0.7 * subtaskProgress);
    } else {
      subtaskProgress = 0.3; // Some subtasks defined but none done yet
    }
  }

  // Weighted formula
  const expectancy =
    (0.40 * completionHistory) +
    (0.25 * retryBehavior) +
    (0.15 * taskSizeConfidence) +
    (0.20 * subtaskProgress);

  return clamp(expectancy, 0, 1);
}

/**
 * Calculate Value (perceived importance/desire for completion)
 * Based on: time investment, voluntary engagement, commitment signals, quality of work
 * @param {Object} task - Current task
 * @returns {number} Value score (0.0 to 1.0)
 */
function calculateValue(task) {
  // Factor 1: Time Investment (30% weight)
  let timeInvestment = 0.5; // Default neutral
  if (task.estimatedDuration && task.actualTimeSpent > 0) {
    const ratio = task.actualTimeSpent / task.estimatedDuration;
    timeInvestment = Math.min(ratio / 2, 1.0); // Cap at 2x estimated = max value
  } else if (task.actualTimeSpent > 0) {
    // No estimate, but time spent indicates value
    timeInvestment = Math.min(task.actualTimeSpent / 60, 1.0); // 60min+ = max
  }

  // Factor 2: Voluntary Engagement (25% weight)
  // How quickly did they start after creating the task?
  const hoursDelayedBeforeStarting = task.hoursDelayedBeforeStarting || 0;
  const voluntaryEngagement = 1 / (1 + hoursDelayedBeforeStarting);

  // Factor 3: Quality of Work Time (20% weight)
  // Ratio of productive work (IDE + academic sites) to total work time
  const ideTime = task.ideTime || 0;
  const academicWebTime = task.academicWebTime || 0;
  const totalWorkTime = task.actualTimeSpent || 1;
  const productiveTimeRatio = Math.min((ideTime + academicWebTime) / totalWorkTime, 1.0);

  // Factor 4: Commitment Signal (10% weight)
  // Fewer postponements = higher commitment
  const postponementCount = task.postponementCount || 0;
  const commitmentSignal = Math.max(0, 1 - (postponementCount / 10));

  // Factor 5: Subtask Engagement (15% weight)
  // Completing subtasks shows engagement and provides sense of accomplishment
  let subtaskEngagement = 0.5; // Default neutral (no subtasks)
  if (task.subtasks && task.subtasks.length > 0) {
    const completedSubtasks = task.subtasks.filter(st => st.done).length;
    const totalSubtasks = task.subtasks.length;

    // Even completing one subtask shows engagement
    if (completedSubtasks > 0) {
      // Base engagement from any completion
      const baseEngagement = 0.4;
      // Additional value from completion ratio
      const progressValue = 0.6 * (completedSubtasks / totalSubtasks);
      subtaskEngagement = baseEngagement + progressValue;
    } else {
      subtaskEngagement = 0.2; // Defined subtasks but none completed yet
    }
  }

  // Weighted formula
  const value =
    (0.30 * timeInvestment) +
    (0.25 * voluntaryEngagement) +
    (0.20 * productiveTimeRatio) +
    (0.10 * commitmentSignal) +
    (0.15 * subtaskEngagement);

  return clamp(value, 0, 1);
}

/**
 * Calculate Impulsiveness (tendency toward distraction)
 * Based on: session interruptions, app switching, procrastination, reminder behavior
 * @param {Object} task - Current task
 * @param {number} userAvgImpulsiveness - User's 7-day rolling average
 * @returns {number} Impulsiveness score (0.0 to 1.0, higher = more impulsive)
 */
function calculateImpulsiveness(task, userAvgImpulsiveness = 0.5) {
  // For new tasks with no session data, use user average
  if (!task.sessions || task.sessions.length === 0) {
    return userAvgImpulsiveness;
  }

  // Factor 1: Session Interruptions (30% weight)
  const pauseResumeCount = task.retryCount || 0;
  const totalSessions = task.sessions.length;
  const interruptions = totalSessions > 0
    ? Math.min(pauseResumeCount / totalSessions, 1.0)
    : 0;

  // Factor 2: Unproductive App Switching (30% weight)
  // Distinguish productive switches (IDE ↔ GitHub) from unproductive (IDE → YouTube)
  const unproductiveAppSwitches = task.unproductiveAppSwitches || 0;
  const productiveAppSwitches = task.productiveAppSwitches || 0;
  const totalAppSwitches = unproductiveAppSwitches + productiveAppSwitches;
  const totalSessionMinutes = task.actualTimeSpent || 1;

  const unproductiveSwitchingRate = totalAppSwitches > 0
    ? unproductiveAppSwitches / totalAppSwitches
    : 0;
  const switchFrequency = Math.min(totalAppSwitches / totalSessionMinutes, 1.0);
  const appSwitching = unproductiveSwitchingRate * switchFrequency;

  // Factor 3: Procrastination Behavior (25% weight)
  // Time spent procrastinating vs total working time
  const totalProcrastinationTime = task.totalProcrastinationTime || 0;
  const procrastinationCount = task.procrastinationCount || 0;
  const workingTime = task.actualTimeSpent || 1;

  const procrastinationRatio = Math.min(totalProcrastinationTime / (workingTime + totalProcrastinationTime), 1.0);
  const procrastinationFrequency = Math.min(procrastinationCount / totalSessions, 1.0);
  const procrastinationFactor = (0.6 * procrastinationRatio) + (0.4 * procrastinationFrequency);

  // Factor 4: Reminder Behavior (15% weight)
  const dismissedReminders = task.dismissedReminders || 0;
  const totalReminders = task.totalReminders || 0;
  const reminderBehavior = totalReminders > 0
    ? dismissedReminders / totalReminders
    : 0;

  // Weighted formula
  const impulsiveness =
    (0.30 * interruptions) +
    (0.30 * appSwitching) +
    (0.25 * procrastinationFactor) +
    (0.15 * reminderBehavior);

  return clamp(impulsiveness, 0, 1);
}

/**
 * Calculate Delay (time until deadline)
 * Based on: deadline distance, urgency factor
 * @param {Object} task - Current task
 * @returns {number} Delay score (0.0 to 1.0, higher = more distant)
 */
function calculateDelay(task) {
  if (!task.deadlineDate) {
    return 1.0; // Maximum delay (no deadline)
  }

  const deadline = new Date(task.deadlineDate);
  if (task.deadlineTime) {
    const [hours, minutes] = task.deadlineTime.split(':');
    deadline.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }

  const now = new Date();
  const msUntilDeadline = deadline.getTime() - now.getTime();
  const hoursUntilDeadline = msUntilDeadline / (1000 * 60 * 60);
  const daysUntilDeadline = hoursUntilDeadline / 24;

  // Handle overdue tasks differently - HIGH delay = demotivating effect
  if (daysUntilDeadline < 0) {
    // Task is overdue - the longer overdue, the MORE demotivating
    // We return a HIGH delay value that increases as task gets more overdue
    // This increases the denominator in the motivation formula, reducing motivation
    const daysOverdue = Math.abs(daysUntilDeadline);

    // Exponential growth of delay penalty
    // Just overdue (<1 day): delay starts at 0.7
    // 2 days overdue: delay ~0.85
    // 5+ days overdue: delay approaches 1.0 (maximum demotivation)
    const overdueDelay = 0.7 + 0.3 * (1.0 - Math.exp(-daysOverdue / 2));

    return clamp(overdueDelay, 0.7, 1.0);
  }

  // Factor 1: Deadline Distance (normalized to 30 days max)
  const deadlineDistance = Math.min(daysUntilDeadline / 30, 1.0);

  // Factor 2: Urgency Factor
  // Within 7 days = increasing urgency
  const urgencyFactor = 1 - Math.min(hoursUntilDeadline / (7 * 24), 1.0);

  // Combined formula
  const delay = deadlineDistance * (1 - urgencyFactor * 0.5);

  return clamp(delay, 0, 1);
}

/**
 * Calculate all TMT variables for a task
 * @param {Object} task - Task to calculate TMT for
 * @param {Array} allTasks - All tasks for historical context
 * @param {number} userAvgImpulsiveness - User's rolling average
 * @returns {Object} TMT scores (0-10 scale for display)
 */
function calculateTMT(task, allTasks = [], userAvgImpulsiveness = 0.5) {
  const expectancy = calculateExpectancy(task, allTasks);
  const value = calculateValue(task);
  const impulsiveness = calculateImpulsiveness(task, userAvgImpulsiveness);
  const delay = calculateDelay(task);

  // Calculate motivation score
  const motivation = (expectancy * value) / (1 + impulsiveness * delay);

  return {
    expectancy: scaleToTen(expectancy),
    value: scaleToTen(value),
    impulsiveness: scaleToTen(impulsiveness),
    delay: scaleToTen(delay),
    motivation: scaleToTen(motivation),
    raw: { expectancy, value, impulsiveness, delay, motivation }
  };
}

/**
 * Get user's rolling 7-day average impulsiveness
 * @param {Array} allTasks - All tasks
 * @returns {number} Average impulsiveness (0.0 to 1.0)
 */
function getUserAverageImpulsiveness(allTasks) {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentTasks = allTasks.filter(t => t.created >= sevenDaysAgo);

  if (recentTasks.length === 0) return 0.5;

  const impulsiveness = recentTasks.map(t =>
    calculateImpulsiveness(t, 0.5)
  );

  const avg = impulsiveness.reduce((a, b) => a + b, 0) / impulsiveness.length;
  return avg;
}

/**
 * Update task's behavioral tracking data
 * @param {Object} task - Task to update
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function updateBehavioralData(task, event, data = {}) {
  // Initialize tracking fields if needed
  if (!task.totalProcrastinationTime) task.totalProcrastinationTime = 0;
  if (!task.procrastinationCount) task.procrastinationCount = 0;
  if (!task.ideTime) task.ideTime = 0;
  if (!task.academicWebTime) task.academicWebTime = 0;
  if (!task.productiveAppSwitches) task.productiveAppSwitches = 0;
  if (!task.unproductiveAppSwitches) task.unproductiveAppSwitches = 0;

  switch (event) {
    case 'task_started':
      if (!task.firstStartTime) {
        task.firstStartTime = Date.now();
        // Calculate hours delayed before starting
        const hoursDelay = (task.firstStartTime - task.created) / (1000 * 60 * 60);
        task.hoursDelayedBeforeStarting = hoursDelay;
      }
      break;

    case 'task_paused':
      task.retryCount = (task.retryCount || 0) + 1;
      break;

    case 'app_backgrounded':
      if (task.status === 'started') {
        task.appBackgroundEvents = (task.appBackgroundEvents || 0) + 1;
      }
      break;

    case 'procrastination_detected':
      // Track procrastination time and frequency
      const duration = data.duration || 0; // Duration in seconds
      const durationMinutes = duration / 60;
      task.totalProcrastinationTime += durationMinutes;
      task.procrastinationCount += 1;

      // Log detailed procrastination data for analytics
      if (!task.procrastinationLog) task.procrastinationLog = [];
      task.procrastinationLog.push({
        timestamp: Date.now(),
        duration: durationMinutes,
        category: data.category, // e.g., 'procrastinating-web', 'other-app'
        detail: data.detail // e.g., 'youtube.com', 'Slack'
      });
      break;

    case 'productive_time_tracked':
      // Track time spent in productive environments
      const productiveDuration = data.duration || 0; // Duration in seconds
      const productiveMinutes = productiveDuration / 60;
      const category = data.category;

      if (category === 'ide') {
        task.ideTime += productiveMinutes;
      } else if (category === 'academic-web') {
        task.academicWebTime += productiveMinutes;
      }
      break;

    case 'app_switched':
      // Track app switching with context
      const isWorking = data.isWorking !== undefined ? data.isWorking : true;
      const fromWorking = data.fromWorking !== undefined ? data.fromWorking : true;

      if (fromWorking && !isWorking) {
        // Switched from productive to unproductive
        task.unproductiveAppSwitches += 1;
      } else if (fromWorking && isWorking) {
        // Switched between productive apps (e.g., IDE to GitHub)
        task.productiveAppSwitches += 1;
      } else if (!fromWorking && isWorking) {
        // Returning to productive work (counted as productive)
        task.productiveAppSwitches += 1;
      }
      // Ignore unproductive → unproductive switches
      break;

    case 'reminder_dismissed':
      task.dismissedReminders = (task.dismissedReminders || 0) + 1;
      task.totalReminders = (task.totalReminders || 0) + 1;
      break;

    case 'reminder_shown':
      task.totalReminders = (task.totalReminders || 0) + 1;
      break;

    case 'deadline_postponed':
      task.postponementCount = (task.postponementCount || 0) + 1;
      break;

    case 'subtask_completed':
      // Track subtask completion - indicates progress and engagement
      // This should boost Expectancy (seeing progress) and Value (sense of accomplishment)
      task.subtasksCompleted = (task.subtasksCompleted || 0) + 1;
      task.lastSubtaskCompletedTime = Date.now();

      // Calculate completion percentage
      if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(st => st.done).length;
        task.subtaskCompletionRatio = completedCount / task.subtasks.length;
      }
      break;

    case 'subtask_uncompleted':
      // User unchecked a subtask - might indicate uncertainty or task difficulty
      if (task.subtasksCompleted > 0) {
        task.subtasksCompleted -= 1;
      }

      // Recalculate completion percentage
      if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(st => st.done).length;
        task.subtaskCompletionRatio = completedCount / task.subtasks.length;
      }
      break;
  }

  return task;
}

/**
 * Get default TMT values for new task
 * @param {Array} allTasks - All tasks for user average
 * @returns {Object} Default TMT values
 */
function getDefaultTMT(allTasks = []) {
  const userAvgImpulsiveness = getUserAverageImpulsiveness(allTasks);

  return {
    expectancy: 5.0,
    value: 5.0,
    impulsiveness: scaleToTen(userAvgImpulsiveness),
    delay: 5.0,
    motivation: 5.0,
    raw: {
      expectancy: 0.5,
      value: 0.5,
      impulsiveness: userAvgImpulsiveness,
      delay: 0.5,
      motivation: 0.5
    }
  };
}

/**
 * Classify motivation state for interventions
 * @param {Object} tmt - TMT scores (raw 0-1 values)
 * @returns {string} State classification
 */
function classifyMotivationState(tmt) {
  const { expectancy, value, impulsiveness, delay } = tmt.raw;

  if (expectancy < 0.3) return 'LOW_EXPECTANCY';
  if (value < 0.3) return 'LOW_VALUE';
  if (impulsiveness > 0.7) return 'HIGH_IMPULSIVENESS';
  if (delay > 0.8) return 'HIGH_DELAY';
  if (expectancy < 0.4 && value < 0.4 && delay > 0.6) return 'PROCRASTINATION_SPIRAL';

  return 'NORMAL';
}

// Utility functions
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scaleToTen(value) {
  return Math.round(value * 10 * 100) / 100; // Round to 2 decimals
}

// Export API
if (typeof window !== 'undefined') {
  window.TMTEngine = {
    calculateTMT,
    calculateExpectancy,
    calculateValue,
    calculateImpulsiveness,
    calculateDelay,
    updateBehavioralData,
    getDefaultTMT,
    getUserAverageImpulsiveness,
    classifyMotivationState
  };
}
