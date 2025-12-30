# FastAPI Backend for Focus Task Manager

This is the FastAPI backend for the Focus Task Manager Electron application. It provides REST API endpoints for task management, TMT (Temporal Motivation Theory) calculations, and event logging.

## Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. **Create a virtual environment** (recommended):
   ```bash
   cd backend
   python -m venv venv
   
   # Activate virtual environment
   # On macOS/Linux:
   source venv/bin/activate
   # On Windows:
   venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

Start the development server with auto-reload:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/api/openapi.json

## API Endpoints

### Tasks (`/api/tasks`)

- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/status/{status}` - Get tasks by status
- `GET /api/tasks/{task_id}` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/{task_id}` - Update task
- `DELETE /api/tasks/{task_id}` - Delete task
- `POST /api/tasks/{task_id}/start` - Start task session
- `POST /api/tasks/{task_id}/pause` - Pause task session
- `POST /api/tasks/{task_id}/complete` - Complete task
- `POST /api/tasks/{task_id}/abandon` - Mark task as abandoned
- `POST /api/tasks/{task_id}/subtasks` - Add subtask
- `POST /api/tasks/{task_id}/subtasks/{subtask_id}/toggle` - Toggle subtask completion

### TMT (Temporal Motivation Theory) (`/api/tmt`)

- `GET /api/tmt/{task_id}` - Get TMT metrics for task
- `POST /api/tmt/{task_id}/recalculate` - Recalculate TMT values

### Events (`/api/events`)

- `POST /api/events` - Log new event
- `GET /api/events` - Get event history (supports `limit` and `event_type` query params)
- `GET /api/events/{event_id}` - Get event by ID

## Architecture

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── models/                # Pydantic data models
│   ├── task.py           # Task models
│   ├── event.py          # Event models
│   └── tmt.py            # TMT models
├── routers/              # API route handlers
│   ├── tasks.py          # Task endpoints
│   ├── events.py         # Event endpoints
│   └── tmt.py            # TMT endpoints
└── services/             # Business logic
    ├── task_service.py   # Task management
    ├── event_service.py  # Event logging
    └── tmt_service.py    # TMT calculations
```

## CORS Configuration

The backend is configured to accept requests from the Electron frontend. CORS origins are defined in `config.py` and include:

- `http://localhost:3000`
- `http://localhost:8080`
- `file://*` (for Electron app)

## Data Storage

Currently, the backend uses **in-memory storage**. This means:

- Data is stored in memory while the server is running
- Data is lost when the server restarts
- Suitable for development and testing

For production use, you should integrate a database (SQLite, PostgreSQL, etc.).

## Development

### Project Structure

- **Models**: Define data schemas using Pydantic for validation
- **Services**: Contain business logic (ported from JavaScript modules)
- **Routers**: Handle HTTP requests and responses

### Adding New Endpoints

1. Create/update models in `models/`
2. Add business logic in `services/`
3. Create router endpoints in `routers/`
4. Register router in `main.py`

## Testing

You can test the API using:

1. **Interactive Docs**: Visit http://localhost:8000/docs
2. **cURL**: 
   ```bash
   curl http://localhost:8000/api/tasks
   ```
3. **Postman** or similar API testing tools

## Next Steps

- [ ] Add database integration (SQLite/PostgreSQL)
- [ ] Implement authentication and authorization
- [ ] Add comprehensive unit tests
- [ ] Port complete TMT calculation logic from `tmtEngine.js`
- [ ] Add intervention endpoints and logic
- [ ] Implement data persistence
