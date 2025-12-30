# GEMINI - Procrastination Prevention Engine
## Comprehensive Developer Reference (Consolidated)

This document is the **single source of truth** for the Procrastination Prevention Application. It combines the original architectural vision with the latest implemented improvements to the Temporal Motivation Theory (TMT) engine.

---

## 1. Project Overview

### Primary Goal
Prevent procrastination by operating as an intelligent **Intervention Engine**:
- **Detect**: Monitor real-time motivation drops using TMT.
- **Intervene**: Trigger targeted nudges (Pomodoro, 2-minute rule, breathing exercises, etc.) when motivation dips.
- **Learn**: Compare motivation levels before and after the intervention to measure effectiveness.
- **Predict**: Use Machine Learning to recommend the *most effective* future nudge based on the user's specific responsiveness and context.

### Core Philosophy
- **Implicit Data Only**: The system works without explicit user questionnaires. All metrics are derived from behavioral data (mouse, keyboard, app usage).
- **Privacy First**: Users push anonymized behavioral data. The system never pulls sensitive content (keylogs, specific text).
- **Non-Judgmental**: Interventions are helpful nudges, not blame.

---

## 2. High-Level Architecture

```
Desktop App (Electron/Node.js)
   ↓  (HTTPS events)
Backend API (Cloud)
   ↓
Central Database
   ↓
Offline ML Training Pipeline
   ↓
Model Deployment
   ↓
Improved Interventions in App
```

---

## 3. The TMT Inference Engine (Updated)

The core of the application is the **Temporal Motivation Theory** equation:

```
Motivation = (Expectancy × Value) / (1 + Impulsiveness × Delay)
```

All variables are computed on a scale of **0.0 to 1.0** (normalized).

### A. Impulsiveness (Significantly Improved)
*Reflects the tendency to get distracted.*

**Old Formula**: Relied heavily on generic app switching.
**New Formula**: Distinguishes between "productive" and "unproductive" switching.

**Factors & Weights:**
1.  **Procrastination Ratio (25%)**: Time spent procrastinating vs. total working time.
    *   *Logic*: Direct measurement of off-task behavior.
2.  **Unproductive App Switching (30%)**: Switching from a "Working" state to a "Non-Working" state (e.g., VS Code → YouTube).
    *   *Contrast*: Switching VS Code → GitHub is now considered *productive* and does not penalize the score.
3.  **Session Interruptions (30%)**: Pause/Resume frequency.
4.  **Reminder Behavior (15%)**: Dismissed reminders.

**Calculation Logic:**
```javascript
Impulsiveness = (0.3 × session_interruptions) + 
                (0.3 × unproductive_app_switches) + 
                (0.25 × procrastination_ratio) + 
                (0.15 × reminder_dismissals)
```

### B. Value (Significantly Improved)
*Reflects the perceived importance and enjoyment of the task.*

**Factors & Weights:**
1.  **Time Investment (35%)**: Actual time spent relative to estimate.
2.  **Voluntary Engagement (30%)**: Inverse of delay before starting.
3.  **Quality of Work Time (20%)** *(New)*: Ratio of "High Quality" time (IDE + Academic Sites) to total work time.
    *   *Logic*: 1 hour in VS Code is higher value than 1 hour just "active" on the desktop.
4.  **Commitment Signal (15%)**: Inverse of postponement count.

**Calculation Logic:**
```javascript
Value = (0.35 × time_investment) + 
        (0.30 × voluntary_engagement) + 
        (0.20 × quality_of_work_time) + 
        (0.15 × commitment_signal)
```

### C. Expectancy (Standard)
*Reflects the belief in successfully completing the task.*

**Factors & Weights:**
1.  **Completion History (50%)**: Success rate in similar categories.
2.  **Retry Behavior (30%)**: Inverse of pause/resume cycles.
3.  **Task Size Confidence (20%)**: Accuracy of time estimation vs. reality.

### D. Delay (Standard)
*Reflects the time urgency.*

**Factors:**
1.  **Deadline Distance**: Normalized time until due date.
2.  **Urgency Factor**: Increases exponentially as deadline approaches.

---

## 4. Data Collection & Behavioral Events

The system silently logs events to build the user profile and task context.

### A. Core Events
- `task_created`, `task_started`, `task_completed`
- `task_paused`, `task_abandoned`
- `postpone_clicked`, `reminder_dismissed`
- `focus_session_started/ended`

### B. Enhanced Events (New)
These specific events drive the improved TMT engine:

1.  **`procrastination_detected`**
    *   **Trigger**: User spends > threshold time in a non-allowed category while a task is active.
    *   **Payload**: `duration`, `category` (e.g., social-media), `timestamp`.
2.  **`productive_time_tracked`**
    *   **Trigger**: User spends time in high-value categories (IDE, Academic Web).
    *   **Payload**: `duration`, `category` (ide/academic-web).
3.  **`app_switched`** (Context-Aware)
    *   **Trigger**: Active window changes.
    *   **Payload**: `from_app`, `to_app`, `is_productive_switch` (calculated based on allowed categories).

### C. Task Object Structure
Tasks now store rich behavioral history:

```javascript
{
  id: "uuid",
  title: "...",
  // ... standard fields ...

  // Procrastination Metrics
  totalProcrastinationTime: 120, // seconds
  procrastinationCount: 2,
  procrastinationLog: [...],

  // Productivity Metrics
  ideTime: 3600, // seconds
  academicWebTime: 600, // seconds

  // Context Switching
  productiveAppSwitches: 5,  // e.g., IDE -> Docs
  unproductiveAppSwitches: 2 // e.g., IDE -> Twitter
}
```

---

## 5. Intervention & Prediction Logic

### A. Motivation State Classification
Based on the TMT score, the system classifies the user into a state:

| State | Definition | Intervention |
|-------|------------|--------------|
| **LOW_EXPECTANCY** | Low confidence, high anxiety. | "Just start for 2 minutes." (Micro-tasking) |
| **LOW_VALUE** | Task feels boring or pointless. | Value reframing / Reminder of long-term goals. |
| **HIGH_IMPULSIVENESS** | Highly distracted. | Enforce shorter focus sessions (Pomodoro). |
| **HIGH_DELAY** | Deadline is far, urgency is low. | Break down into immediate milestones. |
| **SPIRAL** | Critical drop in all metrics. | Compassion reset ("It's okay to restart"). |

### B. Intervention Feedback Loop
The system treats interventions as experiments to optimize user productivity.

1.  **Trigger**: Motivation drops below threshold (or procrastination predicted).
2.  **Action**: System selects a Nudge (e.g., "Start for 2 minutes").
3.  **Interaction**: User accepts, dismisses, or ignores the nudge.
4.  **Evaluation**: Compare Motivation Score ($M_{t+5min}$) vs ($M_{t-1min}$).
    *   *Positive Outcome*: User returns to productive app, $M$ increases.
    *   *Negative Outcome*: User continues distracting behavior, $M$ stays low.

### C. Machine Learning Target (Adaptive Nudging)
The ML model now focuses on **Intervention Recommendation**.

*   **Goal**: Predict the intervention with the highest probability of restoring productivity.
*   **Input Features**:
    *   Current TMT State (Low Value vs. High Impulsiveness).
    *   Context (Time of day, Task Type, Previous Nudge fatigue).
*   **Output**: Ranked list of interventions (e.g., [Pomodoro, Break, Reframing]).
*   **Training Signal**: The "Evaluation" metric defined above (Change in Motivation Score).

---

## 6. Implementation Details & Known Issues

### Active Window Monitoring
- Uses `@miniben90/x-win`.
- **CRITICAL FIX**: Must import using `{ activeWindowAsync }` destructuring, not default import.
- **Logic**: Tracks "Productive Sessions". A session is only logged if it lasts > 5 seconds (debounce to prevent noise).

### Categories
- **IDE**: VS Code, WebStorm, Terminal, etc.
- **Academic/Work Web**: Stack Overflow, GitHub, Documentation sites.
- **Distraction**: Social media, Video streaming, Gaming.

---

## 7. Testing & Validation

To verify the TMT Engine:

1.  **Productive Flow**:
    *   Start a task. Open VS Code. Work for 2 mins. Switch to GitHub.
    *   *Expected Result*: `productiveAppSwitches` increments. `ideTime` increases. Motivation/Value stays high.
2.  **Distracted Flow**:
    *   Start a task. Switch to YouTube.
    *   *Expected Result*: `procrastination_detected` fires. `unproductiveAppSwitches` increments. Impulsiveness spikes. Motivation drops.

---

**Use this document as the primary reference for all future development.**
