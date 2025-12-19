# TMT Engine Improvements

## Overview
Enhanced the Temporal Motivation Theory (TMT) engine to better utilize behavioral data from the intelligent activity monitoring system.

## Date
December 19, 2025

## Changes Made

### 1. Enhanced Impulsiveness Calculation

**Previous Implementation:**
- Session Interruptions: 40%
- App Switching (generic): 40%
- Reminder Behavior: 20%

**New Implementation:**
- Session Interruptions: 30%
- Unproductive App Switching: 30%
- Procrastination Behavior: 25%
- Reminder Behavior: 15%

**Key Improvements:**
- **Distinguishes productive from unproductive app switches**: Switching from IDE to GitHub (productive) is now treated differently from IDE to YouTube (unproductive)
- **Direct procrastination tracking**: Uses actual procrastination time and frequency data
  - Procrastination ratio: Time procrastinating vs total working time (60% weight)
  - Procrastination frequency: Number of procrastination sessions per total sessions (40% weight)
- **Context-aware app switching**: Uses `fromWorking` state to determine if a switch represents distraction

### 2. Enhanced Value Calculation

**Previous Implementation:**
- Time Investment: 40%
- Voluntary Engagement: 40%
- Commitment Signal: 20%

**New Implementation:**
- Time Investment: 35%
- Voluntary Engagement: 30%
- Quality of Work Time: 20%
- Commitment Signal: 15%

**Key Improvements:**
- **Quality of Work Time**: New factor that measures the ratio of productive work time (IDE + academic websites) to total work time
- **Differentiates IDE from academic web time**: Both count as productive, but are tracked separately for analytics

### 3. New Behavioral Events

Added three new event types to `updateBehavioralData()`:

#### `procrastination_detected`
- **Data tracked**: duration (seconds), category, detail
- **Updates**:
  - `totalProcrastinationTime` (cumulative minutes)
  - `procrastinationCount` (number of sessions)
  - `procrastinationLog` (detailed history with timestamps)

#### `productive_time_tracked`
- **Data tracked**: duration (seconds), category (ide/academic-web)
- **Updates**:
  - `ideTime` (cumulative minutes in IDEs)
  - `academicWebTime` (cumulative minutes on academic websites)

#### `app_switched`
- **Data tracked**: from, to, category, isWorking, fromWorking
- **Updates**:
  - `productiveAppSwitches` (count of productive context switches)
  - `unproductiveAppSwitches` (count of distracting context switches)
- **Logic**:
  - Working → Working: productive switch
  - Working → Not working: unproductive switch
  - Not working → Working: productive switch (returning to work)
  - Not working → Not working: ignored

### 4. New Task Fields

Added to task object:
```javascript
{
  // Procrastination tracking
  totalProcrastinationTime: 0,      // minutes
  procrastinationCount: 0,           // number of sessions
  procrastinationLog: [],            // detailed history

  // Productive time tracking
  ideTime: 0,                        // minutes in IDEs
  academicWebTime: 0,                // minutes on academic sites

  // App switching tracking
  productiveAppSwitches: 0,          // count
  unproductiveAppSwitches: 0         // count
}
```

### 5. Enhanced Active Window Monitoring (renderer.js)

**New Features:**
- **Productive time session tracking**: Automatically tracks time spent in IDE and academic websites
- **Session boundary detection**: Saves productive sessions when category changes or procrastination starts
- **Minimum duration threshold**: Only tracks sessions > 5 seconds to avoid noise
- **State persistence**: Maintains `lastWorkingState` for accurate app switch classification

**Implementation Details:**
```javascript
// Track productive time
let productiveStartTime = null;
let productiveCategory = null;
let lastWorkingState = true;

// When user is productive
if (category === 'ide' || category === 'academic-web') {
  if (!productiveStartTime || productiveCategory !== category) {
    // Save previous session if category changed
    // Start new session
  }
}

// When user starts procrastinating
if (productiveStartTime && productiveCategory) {
  // Save productive session
  TMTEngine.updateBehavioralData(task, 'productive_time_tracked', {...});
}
```

## Scientific Rationale

### Why These Changes Matter

1. **Procrastination is a direct measure of impulsiveness**:
   - Previous implementation inferred impulsiveness from generic app switching
   - New implementation uses actual procrastination events with duration and context

2. **Quality over quantity for Value**:
   - Spending 2 hours on YouTube shows low value
   - Spending 2 hours in VS Code shows high value
   - The new Quality of Work Time factor (20%) captures this distinction

3. **Context-aware app switching**:
   - Not all app switches are equal
   - IDE → GitHub → Stack Overflow = focused research (low impulsiveness)
   - IDE → YouTube → Instagram = distraction (high impulsiveness)
   - The new implementation distinguishes these patterns

## Impact on TMT Calculations

### Example Scenario 1: Focused Developer
- **Behavior**: Works in VS Code for 45 min, switches to GitHub for 10 min, back to VS Code
- **Previous**: High impulsiveness (2 app switches)
- **New**: Low impulsiveness (2 productive switches, 0 procrastination)
- **Result**: Higher motivation score ✓

### Example Scenario 2: Distracted Developer
- **Behavior**: Works in VS Code for 10 min, YouTube for 20 min, Facebook for 15 min
- **Previous**: High impulsiveness (2 app switches)
- **New**: Very high impulsiveness (2 unproductive switches, 35 min procrastination)
- **Result**: Much lower motivation score ✓

### Example Scenario 3: Researcher
- **Behavior**: GitHub Issues for 20 min, Stack Overflow for 15 min, MDN Docs for 10 min
- **Previous**: Medium Value (time spent, but not in "IDE")
- **New**: High Value (45 min academic web time counts as quality work)
- **Result**: Higher motivation score ✓

## Testing Recommendations

1. **Create a task and start it**
2. **Test productive workflow**:
   - Work in VS Code for 2 minutes
   - Switch to GitHub for 1 minute
   - Check DevTools console for productive time tracking logs
   - Verify TMT values show low impulsiveness

3. **Test procrastination detection**:
   - Switch to YouTube for 30 seconds
   - Check console for procrastination detection
   - Verify TMT impulsiveness increases

4. **Verify task fields**:
   - Open DevTools → Application → Local Storage
   - Check task object has new fields: `ideTime`, `academicWebTime`, `totalProcrastinationTime`, etc.

5. **Check motivation chart**:
   - Motivation should decrease during procrastination
   - Motivation should increase during focused work
   - Chart should update every 60 seconds

## Future Enhancements

1. **Machine learning prediction**: Use procrastinationLog to predict when user is likely to procrastinate
2. **Adaptive interventions**: Higher impulsiveness → more frequent reminders
3. **Productivity patterns**: Identify user's most productive times of day
4. **Website customization**: Allow users to add custom academic/non-academic sites
5. **Confidence scoring**: Weight TMT calculations by data quality (more sessions = higher confidence)

## Bug Fixes

### Active Window Monitoring Import Error
**Issue**: `TypeError: getActiveWindow is not a function`

**Root Cause**: Incorrect import from `@miniben90/x-win` package. The package exports `activeWindowAsync` not `getActiveWindow`.

**Fix**:
```javascript
// Before (incorrect)
const getActiveWindow = require('@miniben90/x-win');
const activeWin = await getActiveWindow();

// After (correct)
const { activeWindowAsync } = require('@miniben90/x-win');
const activeWin = await activeWindowAsync();
```

**File**: `/index.js` lines 3 and 500

## Files Modified

1. `/frontend/modules/tmtEngine.js` - Core TMT calculations
2. `/frontend/renderer.js` - Active window monitoring integration
3. `/index.js` - Fixed active window import (bug fix)

## Backward Compatibility

✅ All existing task fields remain functional
✅ Tasks without new fields default to 0 values
✅ TMT calculations gracefully handle missing data
