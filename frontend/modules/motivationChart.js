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
  ctx.fillStyle = '#9ca3af';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No tasks yet. Create tasks to see motivation trends!', width / 2, height / 2);
}

/**
 * Draw axes
 */
function drawAxes(dataPoints, padding, chartWidth, chartHeight) {
  ctx.strokeStyle = '#e5e7eb';
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
  ctx.fillStyle = '#374151';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Motivation Score', 0, 0);
  ctx.restore();

  // X-axis label
  ctx.fillStyle = '#374151';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Time (1 min intervals)', padding.left + chartWidth / 2, padding.top + chartHeight + 50);

  // X-axis time labels
  if (dataPoints && dataPoints.length > 0) {
    const now = Date.now();
    const oldestDate = dataPoints[0].date;
    const timeRange = now - oldestDate || 1;

    // Calculate number of time labels to show (aim for ~5-8 labels)
    const numLabels = Math.min(8, Math.max(3, Math.floor(chartWidth / 80)));

    for (let i = 0; i <= numLabels; i++) {
      const ratio = i / numLabels;
      const timestamp = oldestDate + (timeRange * ratio);
      const x = padding.left + (ratio * chartWidth);
      const y = padding.top + chartHeight;

      // Format time
      const date = new Date(timestamp);
      const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      // Draw tick mark
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#6b7280';
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
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1;

  // Horizontal grid lines (for motivation scores 0-10)
  for (let i = 0; i <= 10; i++) {
    const y = padding.top + chartHeight - (i / 10) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(i.toString(), padding.left - 10, y + 4);
  }

  // Vertical grid lines (for time intervals)
  if (dataPoints && dataPoints.length > 0) {
    const numLabels = Math.min(8, Math.max(3, Math.floor(chartWidth / 80)));

    ctx.strokeStyle = '#f3f4f6';
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

  const now = Date.now();
  const oldestDate = dataPoints[0].date;
  const timeRange = now - oldestDate || 1;

  // Convert data points to coordinates
  const points = dataPoints.map(point => ({
    x: padding.left + ((point.date - oldestDate) / timeRange) * chartWidth,
    y: padding.top + chartHeight - (point.motivation / 10) * chartHeight
  }));

  // Draw gradient fill under the line
  if (points.length > 0) {
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');

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
    ctx.strokeStyle = '#1a73e8'; // Google blue
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
  const now = Date.now();
  const oldestDate = dataPoints[0].date;
  const timeRange = now - oldestDate || 1;

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

  const now = Date.now();
  const oldestDate = dataPoints[0].date;
  const timeRange = now - oldestDate || 1;

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
    { label: 'Motivation', color: '#3b82f6', style: 'line' },
    { label: 'Trend', color: '#8b5cf6', style: 'dashed' },
    { label: 'Completed', color: '#10b981', style: 'circle' },
    { label: 'In Progress', color: '#3b82f6', style: 'circle' },
    { label: 'Pending', color: '#9ca3af', style: 'circle' }
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
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#374151';
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

// Export API
if (typeof window !== 'undefined') {
  window.MotivationChart = {
    initChart,
    renderChart,
    getAverageMotivation,
    getMotivationTrend,
    setPeriod,
    getCurrentPeriod
  };
}
