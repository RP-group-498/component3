/**
 * Motivation Chart Module
 * Visualizes user's motivation trends over time across all tasks
 * Google-style currency graph with period selectors
 */

let canvas = null;
let ctx = null;
let selectedPeriod = '1d'; // Default period

// Period mappings in milliseconds
const PERIODS = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  'max': Infinity
};

/**
 * Initialize the chart with canvas element
 * @param {HTMLCanvasElement} canvasElement - Canvas element for rendering
 */
function initChart(canvasElement) {
  canvas = canvasElement;
  if (!canvas) {
    console.error('[MotivationChart] Canvas element not found');
    return { success: false };
  }

  ctx = canvas.getContext('2d');

  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  console.log('[MotivationChart] Initialized');
  return { success: true };
}

/**
 * Resize canvas to fit container
 */
function resizeCanvas() {
  if (!canvas) return;

  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();

  // Set canvas size with device pixel ratio for sharp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Scale context to match DPR
  ctx.scale(dpr, dpr);

  // Set display size
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

/**
 * Render motivation chart with all tasks
 * @param {Array} tasks - Array of tasks to visualize
 */
function renderChart(tasks) {
  if (!ctx || !canvas) return;

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (!tasks || tasks.length === 0) {
    renderEmptyState(width, height);
    return;
  }

  // Calculate motivation for each task
  const allDataPoints = tasks
    .map(task => {
      const tmt = window.TMTEngine
        ? window.TMTEngine.calculateTMT(task, tasks)
        : { motivation: 5, expectancy: 5, value: 5, impulsiveness: 5, delay: 5 };

      return {
        date: task.created,
        motivation: tmt.motivation,
        expectancy: tmt.expectancy,
        value: tmt.value,
        impulsiveness: tmt.impulsiveness,
        status: task.status,
        text: task.text
      };
    })
    .sort((a, b) => a.date - b.date);

  // Filter data points based on selected period
  const now = Date.now();
  const periodMs = PERIODS[selectedPeriod] || PERIODS['1d'];
  const cutoffTime = now - periodMs;

  const dataPoints = selectedPeriod === 'max'
    ? allDataPoints
    : allDataPoints.filter(point => point.date >= cutoffTime);

  // Define chart dimensions
  const padding = { top: 30, right: 30, bottom: 60, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Draw axes
  drawAxes(dataPoints, padding, chartWidth, chartHeight);

  // Draw grid
  drawGrid(dataPoints, padding, chartWidth, chartHeight);

  // Draw data
  drawMotivationLine(dataPoints, padding, chartWidth, chartHeight);
  drawDataPoints(dataPoints, padding, chartWidth, chartHeight);
  drawTrendLine(dataPoints, padding, chartWidth, chartHeight);

  // Draw legend
  drawLegend(padding, width);
}

/**
 * Draw empty state when no tasks
 */
function renderEmptyState(width, height) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No tasks yet. Create tasks to see motivation trends!', width / 2, height / 2);
}

/**
 * Draw axes
 */
function drawAxes(dataPoints, padding, chartWidth, chartHeight) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.stroke();

  // X-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();

  // Y-axis label
  ctx.save();
  ctx.translate(15, padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Motivation Score', 0, 0);
  ctx.restore();

  // X-axis label (show selected period)
  const periodLabels = {
    '5m': 'Last 5 Minutes',
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '1d': 'Last 24 Hours',
    '3d': 'Last 3 Days',
    '1w': 'Last Week',
    '1M': 'Last Month',
    'max': 'All Time'
  };
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(periodLabels[selectedPeriod] || 'Time', padding.left + chartWidth / 2, padding.top + chartHeight + 50);

  // X-axis time labels
  if (dataPoints && dataPoints.length > 0) {
    const oldestDate = dataPoints[0].date;
    const newestDate = dataPoints[dataPoints.length - 1].date;
    const timeRange = newestDate - oldestDate || 1;

    // Calculate number of time labels to show (aim for ~5-8 labels)
    const numLabels = Math.min(8, Math.max(3, Math.floor(chartWidth / 80)));

    // Determine time format based on period
    const isLongPeriod = ['3d', '1w', '1M', 'max'].includes(selectedPeriod);
    const periodMs = PERIODS[selectedPeriod] || PERIODS['1d'];
    const isVeryLongPeriod = periodMs > 7 * 24 * 60 * 60 * 1000; // More than a week

    for (let i = 0; i <= numLabels; i++) {
      const ratio = i / numLabels;
      const timestamp = oldestDate + (timeRange * ratio);
      const x = padding.left + (ratio * chartWidth);
      const y = padding.top + chartHeight;

      // Format time based on period length
      const date = new Date(timestamp);
      let timeStr;

      if (isVeryLongPeriod) {
        // Show date for very long periods
        timeStr = `${date.getMonth() + 1}/${date.getDate()}`;
      } else if (isLongPeriod) {
        // Show date and time for long periods
        timeStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
      } else {
        // Show just time for short periods
        timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      }

      // Draw tick mark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, x, y + 18);
    }
  }
}

/**
 * Draw grid lines
 */
function drawGrid(dataPoints, padding, chartWidth, chartHeight) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  // Horizontal grid lines (for motivation scores 0-10)
  for (let i = 0; i <= 10; i++) {
    const y = padding.top + chartHeight - (i / 10) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(i.toString(), padding.left - 10, y + 4);
  }

  // Vertical grid lines (for time intervals)
  if (dataPoints && dataPoints.length > 0) {
    const numLabels = Math.min(8, Math.max(3, Math.floor(chartWidth / 80)));

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= numLabels; i++) {
      const ratio = i / numLabels;
      const x = padding.left + (ratio * chartWidth);

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }
  }
}

/**
 * Draw motivation line with smooth curves and gradient fill (Google style)
 */
function drawMotivationLine(dataPoints, padding, chartWidth, chartHeight) {
  if (dataPoints.length === 0) return;

  const oldestDate = dataPoints[0].date;
  const newestDate = dataPoints[dataPoints.length - 1].date;
  const timeRange = newestDate - oldestDate || 1;

  // Convert data points to coordinates
  const points = dataPoints.map(point => ({
    x: padding.left + ((point.date - oldestDate) / timeRange) * chartWidth,
    y: padding.top + chartHeight - (point.motivation / 10) * chartHeight
  }));

  // Draw gradient fill under the line
  if (points.length > 0) {
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.3)');
    gradient.addColorStop(1, 'rgba(96, 165, 250, 0.01)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartHeight);
    ctx.lineTo(points[0].x, points[0].y);

    // Draw smooth curve
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const cp2y = p1.y;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
    }

    ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();
  }

  // Draw the line
  if (points.length > 0) {
    ctx.strokeStyle = '#60a5fa'; // Brighter blue
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Draw smooth curve
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const cp2y = p1.y;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
    }

    ctx.stroke();
  }
}

/**
 * Draw individual data points
 */
function drawDataPoints(dataPoints, padding, chartWidth, chartHeight) {
  if (dataPoints.length === 0) return;

  const oldestDate = dataPoints[0].date;
  const newestDate = dataPoints[dataPoints.length - 1].date;
  const timeRange = newestDate - oldestDate || 1;

  dataPoints.forEach(point => {
    const x = padding.left + ((point.date - oldestDate) / timeRange) * chartWidth;
    const y = padding.top + chartHeight - (point.motivation / 10) * chartHeight;

    // Color by status
    const colors = {
      pending: '#9ca3af',
      started: '#3b82f6',
      paused: '#f59e0b',
      completed: '#10b981',
      abandoned: '#ef4444'
    };

    ctx.fillStyle = colors[point.status] || '#9ca3af';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    // White border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/**
 * Draw trend line (linear regression)
 */
function drawTrendLine(dataPoints, padding, chartWidth, chartHeight) {
  if (dataPoints.length < 2) return;

  const oldestDate = dataPoints[0].date;
  const newestDate = dataPoints[dataPoints.length - 1].date;
  const timeRange = newestDate - oldestDate || 1;

  // Calculate linear regression
  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  dataPoints.forEach((point, i) => {
    const x = i;
    const y = point.motivation;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Draw trend line
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();

  const y1 = intercept;
  const y2 = slope * (n - 1) + intercept;

  const x1 = padding.left;
  const x2 = padding.left + chartWidth;
  const cy1 = padding.top + chartHeight - (y1 / 10) * chartHeight;
  const cy2 = padding.top + chartHeight - (y2 / 10) * chartHeight;

  ctx.moveTo(x1, cy1);
  ctx.lineTo(x2, cy2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draw legend
 */
function drawLegend(padding, width) {
  const legendItems = [
    { label: 'Motivation', color: '#60a5fa', style: 'line' },
    { label: 'Trend', color: '#a78bfa', style: 'dashed' },
    { label: 'Completed', color: '#34d399', style: 'circle' },
    { label: 'In Progress', color: '#60a5fa', style: 'circle' },
    { label: 'Pending', color: '#d1d5db', style: 'circle' }
  ];

  const legendX = width - 150;
  let legendY = padding.top;

  legendItems.forEach((item, index) => {
    const y = legendY + index * 20;

    if (item.style === 'line') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + 20, y);
      ctx.stroke();
    } else if (item.style === 'dashed') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + 20, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (item.style === 'circle') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX + 10, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 25, y + 4);
  });
}

/**
 * Get average motivation across all tasks
 * @param {Array} tasks - Array of tasks
 * @returns {number} Average motivation score
 */
function getAverageMotivation(tasks) {
  if (!tasks || tasks.length === 0) return 0;

  const motivations = tasks.map(task => {
    const tmt = window.TMTEngine
      ? window.TMTEngine.calculateTMT(task, tasks)
      : { motivation: 5 };
    return tmt.motivation;
  });

  const sum = motivations.reduce((a, b) => a + b, 0);
  return (sum / motivations.length).toFixed(1);
}

/**
 * Get motivation trend (positive, negative, or stable)
 * @param {Array} tasks - Array of tasks
 * @returns {string} Trend direction
 */
function getMotivationTrend(tasks) {
  if (!tasks || tasks.length < 2) return 'stable';

  const sorted = [...tasks].sort((a, b) => a.created - b.created);
  const midpoint = Math.floor(sorted.length / 2);

  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const avgFirst = getAverageMotivation(firstHalf);
  const avgSecond = getAverageMotivation(secondHalf);

  const diff = avgSecond - avgFirst;

  if (diff > 0.5) return 'increasing';
  if (diff < -0.5) return 'decreasing';
  return 'stable';
}

/**
 * Set the selected period for chart display
 * @param {string} period - Period identifier (5m, 1h, 6h, 1d, 3d, 1w, 1M, max)
 */
function setPeriod(period) {
  if (PERIODS.hasOwnProperty(period)) {
    selectedPeriod = period;
    console.log(`[MotivationChart] Period changed to: ${period}`);
  } else {
    console.warn(`[MotivationChart] Invalid period: ${period}`);
  }
}

/**
 * Get current selected period
 * @returns {string} Current period
 */
function getCurrentPeriod() {
  return selectedPeriod;
}

/**
 * Generate CSV data for download
 * @param {Array} tasks - Array of all tasks
 * @returns {string} CSV content
 */
function generateCSV(tasks) {
  if (!tasks || tasks.length === 0) {
    return 'No data available for the selected period';
  }

  // Get selected period
  const periodMs = PERIODS[selectedPeriod] || PERIODS['1d'];
  const now = Date.now();
  const startTime = selectedPeriod === 'max'
    ? Math.min(...tasks.map(t => t.created))
    : now - periodMs;
  const endTime = now;

  // Generate minute-by-minute data points
  const csvRows = [];
  csvRows.push('Timestamp,Date,Time,Average Motivation,Active Task,Task Status,Activity,Software/Program,Window Title,Category');

  // Sample every minute for the selected period
  const minuteMs = 60 * 1000;
  let currentTime = startTime;

  while (currentTime <= endTime) {
    const date = new Date(currentTime);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
    const timestamp = date.toISOString();

    // Find which task was active at this time
    let activeTask = null;
    let activity = 'Idle';
    let taskStatus = '-';
    let category = '-';
    let software = '-';
    let windowTitle = '-';

    for (const task of tasks) {
      // Check if task has a session that includes this time
      if (task.sessions && task.sessions.length > 0) {
        for (const session of task.sessions) {
          if (session.startTime <= currentTime && session.endTime >= currentTime) {
            activeTask = task;
            taskStatus = 'Working';
            category = task.category || 'personal';

            // Find the closest activity log entry to this time
            if (task.activityLog && task.activityLog.length > 0) {
              // Find activity log entry closest to current time (within session)
              let closestLog = null;
              let minDiff = Infinity;

              for (const log of task.activityLog) {
                if (log.timestamp >= session.startTime && log.timestamp <= session.endTime) {
                  const diff = Math.abs(log.timestamp - currentTime);
                  if (diff < minDiff && diff <= 60000) { // Within 1 minute
                    minDiff = diff;
                    closestLog = log;
                  }
                }
              }

              if (closestLog) {
                software = closestLog.appName || closestLog.detail;
                windowTitle = closestLog.windowTitle || '-';

                // Determine activity based on log
                if (!closestLog.isWorking) {
                  activity = `Procrastinating`;
                } else if (closestLog.category === 'ide') {
                  activity = 'Working (IDE)';
                } else if (closestLog.category === 'academic-web') {
                  activity = `Working (${closestLog.detail})`;
                } else {
                  activity = 'Working on task';
                }
              } else {
                activity = 'Working on task';
              }
            } else if (task.procrastinationLog && task.procrastinationLog.length > 0) {
              // Fallback to procrastination log if no activity log
              const procLog = task.procrastinationLog.find(p => {
                const pTime = p.timestamp;
                const pEnd = pTime + (p.duration * 60 * 1000);
                return pTime <= currentTime && pEnd >= currentTime;
              });

              if (procLog) {
                activity = `Procrastinating`;
                software = procLog.detail || procLog.category;
              } else {
                activity = 'Working on task';
              }
            } else {
              activity = 'Working on task';
            }
            break;
          }
        }
      }

      // Check if task is currently active (ongoing session)
      if (task.status === 'started' && task.currentSessionStart) {
        if (task.currentSessionStart <= currentTime && currentTime <= now) {
          activeTask = task;
          taskStatus = 'In Progress';
          category = task.category || 'personal';

          // Find the closest activity log entry for current session
          if (task.activityLog && task.activityLog.length > 0) {
            let closestLog = null;
            let minDiff = Infinity;

            for (const log of task.activityLog) {
              if (log.timestamp >= task.currentSessionStart) {
                const diff = Math.abs(log.timestamp - currentTime);
                if (diff < minDiff && diff <= 60000) { // Within 1 minute
                  minDiff = diff;
                  closestLog = log;
                }
              }
            }

            if (closestLog) {
              software = closestLog.appName || closestLog.detail;
              windowTitle = closestLog.windowTitle || '-';

              if (!closestLog.isWorking) {
                activity = `Procrastinating`;
              } else if (closestLog.category === 'ide') {
                activity = 'Working (IDE)';
              } else if (closestLog.category === 'academic-web') {
                activity = `Working (${closestLog.detail})`;
              } else {
                activity = 'Working on task';
              }
            } else {
              activity = 'Working on task';
            }
          } else {
            activity = 'Working on task';
          }
        }
      }

      if (activeTask) break;
    }

    // Calculate average motivation at this point in time
    let avgMotivation = 0;
    if (tasks.length > 0) {
      // Get tasks that existed at this time
      const existingTasks = tasks.filter(t => t.created <= currentTime);

      if (existingTasks.length > 0 && window.TMTEngine) {
        const motivations = existingTasks.map(task => {
          const tmt = window.TMTEngine.calculateTMT(task, tasks);
          return tmt.motivation;
        });
        const sum = motivations.reduce((a, b) => a + b, 0);
        avgMotivation = (sum / motivations.length).toFixed(2);
      }
    }

    const taskName = activeTask ? `"${activeTask.text.replace(/"/g, '""')}"` : '-';

    // Escape quotes in software and window title for CSV
    const softwareEscaped = software.replace(/"/g, '""');
    const windowTitleEscaped = windowTitle.replace(/"/g, '""');

    csvRows.push(
      `${timestamp},${dateStr},${timeStr},${avgMotivation},${taskName},${taskStatus},"${activity}","${softwareEscaped}","${windowTitleEscaped}",${category}`
    );

    currentTime += minuteMs;
  }

  return csvRows.join('\n');
}

/**
 * Download CSV file
 * @param {Array} tasks - Array of all tasks
 */
function downloadCSV(tasks) {
  const csvContent = generateCSV(tasks);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);

  // Generate filename with period and timestamp
  const periodLabels = {
    '5m': '5min',
    '1h': '1hour',
    '6h': '6hours',
    '1d': '1day',
    '3d': '3days',
    '1w': '1week',
    '1M': '1month',
    'max': 'all-time'
  };
  const periodLabel = periodLabels[selectedPeriod] || selectedPeriod;
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `motivation-data-${periodLabel}-${timestamp}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('[MotivationChart] CSV downloaded:', periodLabel);
}

// Export API
if (typeof window !== 'undefined') {
  window.MotivationChart = {
    initChart,
    renderChart,
    getAverageMotivation,
    getMotivationTrend,
    setPeriod,
    getCurrentPeriod,
    generateCSV,
    downloadCSV
  };
}
