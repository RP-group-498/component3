# Procrastination Prevention App
## Step-by-Step Implementation Guide (TMT + CBT + ACT + ML)

This document is a **developer reference guide** for implementing a procrastination prevention application using:
- **Temporal Motivation Theory (TMT)** for motivation modeling
- **CBT & ACT** for intervention logic
- **Machine Learning (ML)** for predictive, preemptive interventions

The system is designed to work **without explicit user questionnaires**, using only **implicit behavioral data**.

---

## 1. Project Goals

### Primary Goal
Prevent procrastination by:
- Detecting motivation drops
- Predicting near-future procrastination
- Applying timely CBT/ACT-based interventions

### Explicit Non-Goals
- No mental health diagnosis
- No therapy replacement
- No self-reported surveys

---

## 2. High-Level Architecture

```
Desktop App (EXE)
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

Key principle:
> **Users push anonymized behavioral data to your backend. You never pull data from users.**

---

## 3. Phase 1 – Core Application

### Step 1: Task Management (CRUD)

Implement basic task features:
- Create / edit / delete tasks
- Deadline
- Estimated duration
- Task category (optional)

Purpose:
- Tasks are the anchor for all motivation modeling

---

### Step 2: Event Logging (Critical)

Log user behavior **silently**.

#### Events to Track
- task_created
- task_started
- task_paused
- task_abandoned
- task_completed
- postpone_clicked
- focus_session_started
- focus_session_ended
- app_backgrounded
- reminder_dismissed

#### Event Payload Example
```json
{
  "user_id": "UUID",
  "event_type": "task_started",
  "timestamp": "ISO-8601",
  "metadata": {}
}
```

Rules:
- Use random UUID per user
- No names, emails, or task text

---

## 4. Phase 2 – Backend & Data Flow

### Step 3: Backend API

Responsibilities:
- Receive events from desktop app
- Validate & store data
- Compute daily aggregates
- Serve predictions & interventions

Suggested endpoints:
- POST /events
- GET /daily-metrics
- GET /predict-risk
- GET /model-version

---

### Step 4: Database Design (Example)

#### users
- user_id (UUID)
- created_at

#### events
- user_id
- event_type
- timestamp
- session_id

#### daily_metrics
- user_id
- date
- expectancy
- value
- impulsiveness
- delay
- motivation_score

---

## 5. Phase 3 – TMT Inference Engine

### Step 5: Compute TMT Variables

TMT Formula (internal):

Motivation = (Expectancy × Value) / (1 + Impulsiveness × Delay)

#### Implicit Computation (CRITICAL: No User Questionnaires)

**ALL TMT variables MUST be computed from behavioral data. NEVER ask users to rate these directly.**

**Expectancy** (belief in successfully completing the task):
```
Factors:
- Completion History: completed_tasks_in_category / total_tasks_in_category
- Retry Behavior: 1 / (1 + retry_count) where retry = pause/resume cycles
- Task Size Confidence: 1 - abs(estimated_duration - average_task_duration) / max_duration

Formula:
Expectancy = (0.5 × completion_history) + (0.3 × retry_behavior) + (0.2 × task_size_confidence)
Range: 0.0 to 1.0 (scale to 0-10 for display)
```

**Value** (perceived importance/desire for task completion):
```
Factors:
- Time Investment: actual_time_spent / estimated_duration (capped at 2.0)
- Voluntary Engagement: 1 / (1 + hours_delayed_before_starting)
- Commitment Signal: 1 - (postponement_count / 10) (capped at 0)

Formula:
Value = (0.4 × time_investment) + (0.4 × voluntary_engagement) + (0.2 × commitment_signal)
Range: 0.0 to 1.0 (scale to 0-10 for display)
```

**Impulsiveness** (tendency toward distraction):
```
Factors:
- Session Interruptions: pause_resume_count / total_sessions (higher = more impulsive)
- App Switching: app_background_events_during_active_session / session_duration_minutes
- Reminder Behavior: dismissed_reminders / total_reminders

Formula:
Impulsiveness = (0.4 × interruptions) + (0.4 × app_switching) + (0.2 × reminder_behavior)
Range: 0.0 to 1.0 (scale to 0-10 for display)
```

**Delay** (time until deadline):
```
Factors:
- Deadline Distance: days_until_deadline / 30 (normalized, capped at 1.0)
- Urgency Factor: 1 if overdue, else 1 - (hours_until_deadline / (7 × 24))

Formula:
Delay = deadline_distance × urgency_factor
Range: 0.0 to 1.0 (scale to 0-10 for display)
Note: Delay is recalculated in real-time as deadline approaches
```

**Default Values for New Tasks:**
- Expectancy: 0.5 (neutral, no history)
- Value: 0.5 (neutral, no engagement data yet)
- Impulsiveness: User's rolling 7-day average (or 0.5 if no history)
- Delay: Calculated from deadline immediately

**Update Frequency:**
- Expectancy: After each task completion/abandonment
- Value: After each work session (real-time during active sessions)
- Impulsiveness: After each pause/resume, app background event
- Delay: Real-time (every minute for tasks with deadline < 48 hours)

Store TMT values **per task** and aggregate **daily per user** for trend analysis.

---

### Step 6: Motivation State Classification

Instead of raw scores, classify states:
- LOW_EXPECTANCY
- LOW_VALUE
- HIGH_IMPULSIVENESS
- HIGH_DELAY
- PROCRASTINATION_SPIRAL

These states drive interventions.

---

## 6. Phase 4 – CBT + ACT Intervention Layer

### Step 7: Intervention Mapping

| Motivation State | Intervention |
|----------------|-------------|
| LOW_EXPECTANCY | Micro-task / 2-minute start |
| LOW_VALUE | Value reframing |
| HIGH_IMPULSIVENESS | Short focus session |
| HIGH_DELAY | Milestone breakdown |
| SPIRAL | Compassion reset |

Principles:
- Non-judgmental
- Optional
- Lightweight

---

### Step 8: Frontend Intervention Delivery

Examples:
- Auto-splitting tasks
- "Start for 2 minutes" CTA
- Adaptive focus session length
- Progress bars toward next milestone

UX Rule:
> Never blame the user.

---

## 7. Phase 5 – Machine Learning Layer

### Step 9: Prediction Target

Recommended target:
- Probability of procrastination in the next session

Label = 1 if:
- Task started late OR
- Task abandoned early

---

### Step 10: Feature Engineering

#### Feature Categories
- TMT scores
- Trends (last 7 days)
- Time of day
- Past failure patterns

Example feature vector:
```
[expectancy, value, impulsiveness, delay, focus_trend, time_of_day]
```

---

### Step 11: Model Training (Offline Only)

Recommended models:
- Logistic Regression
- Random Forest

Process:
1. Export anonymized data
2. Train model offline
3. Validate (AUC, Recall)
4. Version the model
5. Deploy to backend

Never train directly on live production data.

---

### Step 12: Prediction Flow

```
User opens app
   ↓
Build feature vector
   ↓
ML predicts risk score
   ↓
If risk > threshold → trigger intervention
```

ML decides **when**, rules decide **what**.

---

## 8. Phase 6 – Continuous Improvement

### Step 13: Retraining Strategy

- Periodic (e.g., monthly)
- Compare old vs new model
- Deploy only if performance improves

This is batch learning, not live learning.

---

## 9. Desktop App (EXE) Data Flow

### Step 14: Data Transmission

- EXE sends events via HTTPS
- Backend stores data centrally
- Offline queue if internet is unavailable

Users never send DB files manually.

---

## 10. Ethics & Privacy

Mandatory:
- Explicit user consent
- Anonymous user IDs
- No sensitive personal data
- Opt-out option

Supervisor-safe description:
> "The application collects anonymized behavioral interaction data solely for improving predictive intervention timing."

---

## 11. Suggested Repository Structure

```
/frontend
/backend
  /event-ingestion
  /tmt-engine
  /intervention-engine
  /ml-training
  /prediction-service
/docs
```

---

## 12. Final Mental Model

- TMT explains *why* motivation drops
- ML predicts *when* procrastination will happen
- CBT & ACT define *how* to intervene
- App delivers interventions gently and early

---

**This document should be used as a living reference during development.**
