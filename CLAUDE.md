# CLAUDE.md - Focus Task Manager Project

## Project Overview

This is an **Electron-based desktop application** for task management with integrated **Task Motivation Theory (TMT)** and **machine learning** capabilities. The app helps users track tasks, maintain focus through Pomodoro sessions, and provides intelligent interventions based on motivation analysis.

## Technology Stack

### Frontend
- **Electron**: Desktop application framework
- **Vanilla JavaScript**: Modular architecture (no framework)
- **HTML/CSS**: UI rendering

### Backend
- **FastAPI**: Python async web framework
- **Motor**: Async MongoDB driver
- **Pydantic**: Data validation and serialization
- **MongoDB**: Primary database (cloud-hosted on MongoDB Atlas)

### Key Libraries
- `@miniben90/x-win`: Window tracking for activity monitoring
- `concurrently`: Run multiple processes (frontend + backend)

## Architecture

### Overall Structure
```
component3/
├── backend/              # FastAPI backend
│   ├── models/          # Pydantic models (data schemas)
│   ├── routers/         # API endpoints
│   ├── services/        # Business logic
│   ├── database.py      # MongoDB connection
│   ├── config.py        # Configuration
│   └── main.py          # FastAPI app entry
├── frontend/            # Electron frontend
│   ├── modules/         # JavaScript modules
│   ├── renderer.js      # Main renderer process
│   └── index.html       # Main UI
├── index.js             # Electron main process
└── package.json         # Node dependencies
```

## Data Models & MongoDB Collections

### Collections

1. **tasks** - Task management
   - Schema: `backend/models/task.py`
   - Fields: id, text, status, subtasks, sessions, TMT values, behavioral tracking
   - Status flow: pending → started → paused/completed/abandoned

2. **events** - Event logging
   - Schema: `backend/models/event.py`
   - Tracks user actions, app events, and system events

3. **ml_training_data** - Machine learning training data
   - Schema: `backend/models/ml_training.py`
   - Stores session events and intervention responses for ML training

4. **app_settings** - Application settings & state
   - Schema: `backend/models/app_settings.py`
   - Stores timer state, active session recovery, user preferences

### Key Data Models

**Task Model** (`backend/models/task.py`):
- Core fields: id, text, deadlineDate, deadlineTime, category
- TMT values: expectancy, value, impulsivity, delay
- Status tracking: status, actualTimeSpent, sessions, currentSessionStart
- Behavioral tracking: retryCount, postponementCount, firstStartTime, etc.
- History: activityLog, interventionHistory, tmtHistory

**TMT (Task Motivation Theory)**:
- Motivation = (Expectancy × Value) / (Impulsivity × Delay)
- Values range from 1-10
- Calculated dynamically based on user behavior

## Frontend Modules

### Core Modules (`frontend/modules/`)

1. **taskManager.js** - Task CRUD and state management
   - API integration for task operations
   - Session tracking (start/pause/complete)
   - Crash recovery for active sessions
   - MongoDB + localStorage (backup)

2. **focusTimer.js** - Pomodoro timer implementation
   - Work/break cycle management
   - Default: 25min work, 5min break, 15min long break
   - Timer state persistence (MongoDB + localStorage)

3. **tmtEngine.js** - TMT calculation engine
   - Calculates motivation scores based on task behavior
   - Factors: completion rate, delay before starting, retries, etc.
   - Triggers interventions on motivation drops

4. **interventionManager.js** - Intervention system
   - Monitors TMT drops and triggers interventions
   - Types: motivation_boost, task_suggestion, break_reminder
   - Logs intervention responses for ML training

5. **eventLogger.js** - Event logging system
   - Logs all user actions and system events
   - Sends events to backend API
   - Settings management

6. **uiManager.js** - UI rendering and updates
   - Task list rendering
   - Timer display
   - Analytics and charts

7. **interventionUI.js** - Intervention UI components
   - Breathing exercise overlay
   - Task suggestion cards
   - Break reminder modals

## Backend Services

### Services (`backend/services/`)

1. **task_service.py** - Task business logic
   - CRUD operations
   - Session management (start/pause/complete)
   - Subtask management
   - TMT integration

2. **event_service.py** - Event logging
   - Store and query events
   - Event filtering by type

3. **ml_training_service.py** - ML data collection
   - Log session events (start, pause, complete)
   - Log intervention events (displayed, accepted/rejected)
   - Export data for ML model training

4. **tmt_service.py** - TMT calculations
   - Server-side TMT calculation
   - Success rate analysis
   - Delay calculations

5. **app_settings_service.py** - Settings & state management
   - App settings (timer durations, preferences)
   - Timer state persistence
   - Active session crash recovery

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

### Tasks (`/tasks`)
- `GET /` - Get all tasks
- `POST /` - Create task
- `GET /{task_id}` - Get task by ID
- `PUT /{task_id}` - Update task
- `DELETE /{task_id}` - Delete task
- `POST /{task_id}/start` - Start task session
- `POST /{task_id}/pause` - Pause task session
- `POST /{task_id}/complete` - Complete task
- `POST /{task_id}/abandon` - Abandon task
- `POST /{task_id}/subtasks` - Add subtask
- `POST /{task_id}/subtasks/{subtask_id}/toggle` - Toggle subtask
- `POST /{task_id}/interventions/log` - Log intervention response

### Events (`/events`)
- `POST /` - Log event
- `GET /` - Get events (with filters)

### TMT (`/tmt`)
- `GET /task/{task_id}` - Calculate TMT for task
- `PUT /task/{task_id}` - Update TMT values

### Interventions (`/interventions`)
- `POST /trigger` - Trigger intervention
- `GET /history` - Get intervention history

### Settings (`/settings`)
- `GET /` - Get app settings
- `PUT /` - Update app settings
- `GET /timer` - Get timer state
- `PUT /timer` - Update timer state
- `DELETE /timer` - Clear timer state
- `POST /active-session` - Save active session (crash recovery)
- `GET /active-session` - Get active session
- `DELETE /active-session` - Clear active session

## Key Features

### 1. Task Management
- Create, update, delete tasks
- Subtask support with estimated durations
- Task status state machine (pending → started → paused/completed/abandoned)
- Session tracking with precise time measurements

### 2. Focus Timer (Pomodoro)
- Configurable work/break durations
- Long break after N sessions
- Timer state persistence across app restarts
- Integration with task sessions

### 3. TMT (Task Motivation Theory)
- Dynamic motivation calculation based on user behavior
- Factors considered:
  - Success rate (completed vs abandoned tasks)
  - Delay before starting tasks
  - Retry count (abandoned then restarted)
  - Progress on subtasks
- Motivation drops trigger interventions

### 4. Intelligent Interventions
- **Motivation Boost**: Encouraging messages when motivation drops
- **Task Suggestions**: Break down large tasks into subtasks
- **Break Reminders**: Prevent burnout with timely breaks
- Response tracking for ML training

### 5. ML Training Data Collection
- Session events: start, pause, complete with context
- Intervention events: type, acceptance, session duration
- Exportable data for training motivation prediction models

### 6. Activity Tracking
- Window/app tracking (via x-win library)
- Activity log per task
- Categorization of productive vs non-productive time

### 7. Crash Recovery
- Active session state saved to MongoDB
- Auto-recovery on app restart
- Preserves session time accurately

## Data Flow

### Task Session Flow
```
1. User clicks "Start" on task
   ↓
2. Frontend: taskManager.startTask(taskId)
   ↓
3. API: POST /api/v1/tasks/{task_id}/start
   ↓
4. Backend: task_service.start_task()
   - Pauses other active tasks
   - Sets currentSessionStart timestamp
   - Updates status to "started"
   - Logs ML training event
   ↓
5. Frontend: Updates UI, starts auto-save interval
   ↓
6. Every 60s: saveActiveSessionState() to MongoDB
   ↓
7. User clicks "Pause"
   ↓
8. API: POST /api/v1/tasks/{task_id}/pause
   ↓
9. Backend: task_service.pause_task()
   - Calculates session duration
   - Adds session to sessions array
   - Updates actualTimeSpent
   - Clears currentSessionStart
   - Logs ML training event
```

### TMT Calculation Flow
```
1. User completes subtask or task state changes
   ↓
2. Frontend: recalculateTMT(taskId)
   ↓
3. tmtEngine.calculateTMT(task, allTasks)
   ↓
4. Calculates:
   - Expectancy (based on success rate)
   - Value (based on deadline proximity, category)
   - Impulsivity (based on retries, abandons)
   - Delay (based on time before starting)
   ↓
5. Motivation = (Expectancy × Value) / (Impulsivity × Delay)
   ↓
6. If motivation dropped significantly:
   interventionManager.analyzeDrop()
   ↓
7. Trigger appropriate intervention
   ↓
8. Log intervention to ML training data
```

## LocalStorage → MongoDB Migration

**Previous**: Data saved only to browser localStorage
**Current**: Data saved to MongoDB with localStorage as backup

### Migrated Data:
1. **Tasks**: Now primary in MongoDB (localStorage = cache)
2. **Timer State**: MongoDB persistence with offline fallback
3. **Active Session**: MongoDB + localStorage for crash recovery
4. **Settings**: Centralized in MongoDB app_settings collection

### Benefits:
- ✅ Data survives browser cache clear
- ✅ Cross-device sync capability (future)
- ✅ Better data integrity
- ✅ Queryable analytics
- ✅ ML training data persistence

## Configuration

### Backend (`backend/config.py`)
- MongoDB connection string
- API settings (host, port, CORS)
- Environment-based configuration

### Frontend
- API URL: `http://localhost:8000/api/v1`
- Timer defaults: 25/5/15 minutes
- Auto-save interval: 60 seconds

## Running the Application

### Start Backend
```bash
cd backend
python main.py
# or
uvicorn main:app --reload
```

### Start Frontend
```bash
npm start
# or
electron .
```

### Run Both Concurrently
```bash
npm run start  # If concurrently configured
```

## Development Workflow

### Adding a New Feature

1. **Backend**:
   - Create/update Pydantic model in `backend/models/`
   - Add service logic in `backend/services/`
   - Create API endpoint in `backend/routers/`
   - Register router in `backend/main.py`

2. **Frontend**:
   - Add business logic to appropriate module in `frontend/modules/`
   - Call API endpoint with fetch()
   - Update UI in `uiManager.js`
   - Add event logging if needed

3. **Testing**:
   - Test API endpoints via `/docs` (FastAPI auto-docs)
   - Test UI in Electron app
   - Check MongoDB data with Compass or CLI

## Important Notes

### Data Persistence Strategy
- **MongoDB**: Primary source of truth
- **localStorage**: Backup/cache for offline resilience
- Always try API first, fallback to localStorage on failure

### Error Handling
- API failures gracefully fallback to localStorage
- All critical operations log errors to console
- Frontend shows user-friendly error messages

### Session Management
- Only ONE task can be active (started) at a time
- Starting a new task auto-pauses the current active task
- Session time calculated server-side to prevent manipulation

### TMT Calculations
- Performed client-side for real-time feedback
- Can also be calculated server-side via API
- History stored for drop detection and analysis

## Future Enhancements

Potential areas for expansion:
- Multi-user support (user authentication)
- Cloud sync across devices
- ML model for predicting task completion probability
- Advanced analytics dashboard
- Team/collaborative task management
- Mobile app integration
- Notification system improvements
- Custom intervention types
- Export/import task data

## Troubleshooting

### Backend won't start
- Check MongoDB connection string in `backend/config.py`
- Ensure MongoDB Atlas cluster is running
- Verify Python dependencies installed (`pip install -r requirements.txt`)

### Frontend can't connect to backend
- Verify backend is running on port 8000
- Check CORS settings in backend
- Inspect browser console for errors

### Data not persisting
- Check MongoDB connection
- Verify localStorage fallback is working
- Check browser console for API errors
- Ensure proper error handling in save functions

### Timer state lost
- Check if timer state saved to MongoDB
- Verify `saveTimerState()` called properly
- Check app_settings collection in MongoDB

## Code Quality & Best Practices

- **Modular Architecture**: Each module has single responsibility
- **Async/Await**: Consistent async patterns throughout
- **Error Handling**: Try-catch blocks with fallbacks
- **Type Safety**: Pydantic models for API validation
- **Documentation**: Comprehensive JSDoc and Python docstrings
- **Separation of Concerns**: Business logic separate from UI
- **API-First**: Backend logic accessible via RESTful API

## Contact & Contribution

For questions about this codebase or contribution guidelines, refer to the project repository or contact the development team.

---

**Last Updated**: 2026-03-02
**Project Version**: 1.0.0
**Backend API Version**: v1
