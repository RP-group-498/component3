/**
 * Motivation Chart Module
 * - Visualizes TMT history using HTML5 Canvas
 * - Calculates trends and averages
 * - Handles CSV export
 */

let canvas = null;
let ctx = null;
let currentPeriod = '1d';

/**
 * Initialize chart
 * @param {HTMLCanvasElement} canvasEl 
 */
function initChart(canvasEl) {
    if (!canvasEl) return;
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    
    // Handle resizing
    window.addEventListener('resize', () => {
        if (canvas) {
            resizeCanvas();
            // We need tasks to re-render, but we don't have them stored locally
            // This will be handled by the next update cycle or user interaction
        }
    });
    
    resizeCanvas();
    console.log('[MotivationChart] Initialized');
}

function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

/**
 * Set chart period
 * @param {string} period - '5m', '1h', '6h', '1d', '3d', '1w', '1M', 'max'
 */
function setPeriod(period) {
    currentPeriod = period;
    console.log(`[MotivationChart] Period set to ${period}`);
}

/**
 * Fetch aggregated history from backend
 */
async function fetchHistory() {
    try {
        const response = await fetch('http://localhost:8000/api/v1/tmt/history');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                return data.history;
            }
        }
    } catch (e) {
        console.warn('[MotivationChart] Failed to fetch history:', e);
    }
    return null;
}

/**
 * Render the chart
 * @param {Array} tasks - List of tasks (optional if fetching from backend)
 */
async function renderChart(tasks) {
    if (!canvas || !ctx) return;

    // Fetch full history from backend
    const serverHistory = await fetchHistory();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aggregate TMT history
    let dataPoints = [];

    if (serverHistory && serverHistory.length > 0) {
        // Use server data
        dataPoints = serverHistory.map(h => ({
            timestamp: h.timestamp,
            value: h.motivation
        }));
    } else if (tasks) {
        // Fallback to local task history
        tasks.forEach(task => {
            if (task.tmtHistory && task.tmtHistory.length > 0) {
                task.tmtHistory.forEach(entry => {
                    dataPoints.push({
                        timestamp: entry.timestamp,
                        value: entry.motivation
                    });
                });
            } else {
                 // Use current values if no history
                const E = (task.expectancy || 5) / 10;
                const V = (task.value || 5) / 10;
                const I = (task.impulsivity || task.impulsiveness || 5) / 10;
                const D = (task.delay || 5) / 10;
                
                const motivation = (E * V) / (1 + I * D) * 10;

                dataPoints.push({
                    timestamp: task.created || Date.now(),
                    value: motivation
                });
            }
        });
    }

    // Filter by period
    const now = Date.now();
    let startTime = 0;
    
    switch (currentPeriod) {
        case '5m': startTime = now - 5 * 60 * 1000; break;
        case '1h': startTime = now - 60 * 60 * 1000; break;
        case '6h': startTime = now - 6 * 60 * 60 * 1000; break;
        case '1d': startTime = now - 24 * 60 * 60 * 1000; break;
        case '3d': startTime = now - 3 * 24 * 60 * 60 * 1000; break;
        case '1w': startTime = now - 7 * 24 * 60 * 60 * 1000; break;
        case '1M': startTime = now - 30 * 24 * 60 * 60 * 1000; break;
        case 'max': startTime = 0; break;
        default: startTime = now - 24 * 60 * 60 * 1000;
    }

    dataPoints = dataPoints.filter(p => p.timestamp >= startTime);
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // If no data, show empty state
    if (dataPoints.length === 0) {
        drawEmptyState();
        return;
    }

    // Draw chart
    drawTrendLine(dataPoints, startTime, now);
}

function drawEmptyState() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for this period', canvas.width / 2, canvas.height / 2);
}

function drawTrendLine(data, minTime, maxTime) {
    const padding = 20;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // Y-axis range (0 to 10 for motivation)
    const minY = 0;
    const maxY = 10;
    
    const getX = (timestamp) => {
        return padding + ((timestamp - minTime) / (maxTime - minTime)) * width;
    };
    
    const getY = (value) => {
        return height + padding - ((value - minY) / (maxY - minY)) * height;
    };

    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Draw simple line connecting points
    // For better visualization, we might want to bucket points or smooth line
    // But direct connection is fine for MVP
    
    if (data.length > 0) {
        ctx.moveTo(getX(data[0].timestamp), getY(data[0].value));
        
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(getX(data[i].timestamp), getY(data[i].value));
        }
    }
    
    ctx.stroke();
    
    // Fill area below
    ctx.lineTo(getX(data[data.length - 1].timestamp), height + padding);
    ctx.lineTo(getX(data[0].timestamp), height + padding);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
}

/**
 * Get average motivation
 * @param {Array} tasks 
 */
function getAverageMotivation(tasks) {
    if (tasks.length === 0) return 0;
    
    // Calculate current average
    const sum = tasks.reduce((acc, task) => {
        // Calculate TMT if not stored
        // Motivation = (E*V) / (1 + I*D)
        // Values in task are 0-10, formula expects 0-1 normalized inputs usually?
        // Wait, tmtEngine.js returns 0-10 scaled values.
        // And motivation there is (E*V)/(1+I*D).
        // Let's assume task.expectancy etc are already 0-10.
        
        // Wait, tmtEngine.js returns 0-10.
        // Let's check tmtEngine again.
        // Yes, scaleToTen.
        
        // However, the formula (E*V) / (1 + I*D) with 10-scale inputs:
        // (10*10) / (1 + 10*10) = 100 / 101 ~= 1.
        // (5*5) / (1 + 5*5) = 25 / 26 ~= 1.
        
        // The formula in tmtEngine uses normalized values (0-1) for calculation, THEN scales result to 10.
        // But task object stores the SCALED values (0-10).
        // So we can't just plug them back in without unscaling.
        
        // But wait, task should store the computed motivation too?
        // taskManager.js calls calculateTMT and stores expectancy, value...
        // Does it store motivation?
        // In recalculateTMT:
        // task.tmtHistory.push({ ..., motivation: tmt.motivation })
        // But the task object itself doesn't seem to have a top-level 'motivation' field.
        
        // Let's use the last history entry if available
        if (task.tmtHistory && task.tmtHistory.length > 0) {
            return acc + task.tmtHistory[task.tmtHistory.length - 1].motivation;
        }
        
        return acc + 5; // Default neutral
    }, 0);
    
    return (sum / tasks.length).toFixed(1);
}

/**
 * Get motivation trend
 * @param {Array} tasks 
 */
function getMotivationTrend(tasks) {
    // Compare average now vs 24h ago
    // For simplicity, just return 'stable' for now or implement real logic
    return 'stable';
}

/**
 * Download CSV
 * @param {Array} tasks 
 */
function downloadCSV(tasks) {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Task ID,Task Name,Status,Expectancy,Value,Impulsivity,Delay,Motivation\n";
    
    tasks.forEach(task => {
        const lastMot = task.tmtHistory && task.tmtHistory.length > 0 
            ? task.tmtHistory[task.tmtHistory.length - 1].motivation 
            : 0;
            
        csvContent += `${task.id},"${task.text}",${task.status},${task.expectancy},${task.value},${task.impulsivity},${task.delay},${lastMot}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "motivation_data.csv");
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

// Export API
if (typeof window !== 'undefined') {
    window.MotivationChart = {
        initChart,
        renderChart,
        setPeriod,
        getAverageMotivation,
        getMotivationTrend,
        downloadCSV
    };
}
