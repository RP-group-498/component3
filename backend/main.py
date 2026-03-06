from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import time
import numpy as np
import motor.motor_asyncio

from bandit import LinUCBArm, get_allowed_actions, select_action, ACTIONS

app = FastAPI(title="Intervention API")

# MongoDB connection
MONGO_DETAILS = "mongodb+srv://it22202468_db_user:H9uZ19ILa07S8Hqh@focusapp.plzzdeo.mongodb.net/"
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client.intervention_db
user_collection = database.get_collection("User")
bandit_models_collection = database.get_collection("bandit_models")
bandit_events_collection = database.get_collection("bandit_events")
motivation_logs_collection = database.get_collection("motivation_logs")

# Configure CORS for Electron/Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserGoal(BaseModel):
    life_goal: str

class InterventionLog(BaseModel):
    strategy: str
    action: str
    timestamp: float = time.time()

class Strategy(BaseModel):
    id: str
    title: str
    description: str

# Mock database for logs
intervention_logs = []
strategies = [
    Strategy(id="pomodoro", title="Pomodoro Timer", description="Focus for 25 minutes, then take a 5-minute break."),
    Strategy(id="5_second_rule", title="5-Second Rule", description="Count down 5-4-3-2-1 and physically move to start your task."),
    Strategy(id="breathing", title="Breathing Exercise", description="Take a moment to calm your mind with guided breathing."),
]

@app.get("/")
async def root():
    return {"message": "Intervention Backend is running"}

@app.get("/user/goal")
async def get_user_goal():
    user = await user_collection.find_one({"type": "settings"})
    if user:
        return {"life_goal": user["life_goal"]}
    return {"life_goal": ""}

@app.post("/user/goal")
async def set_user_goal(goal: UserGoal):
    await user_collection.update_one(
        {"type": "settings"},
        {"$set": {"life_goal": goal.life_goal}},
        upsert=True
    )
    return {"status": "success"}

@app.get("/strategies", response_model=List[Strategy])
async def get_strategies():
    return strategies

@app.post("/log")
async def log_intervention(log: InterventionLog):
    intervention_logs.append(log)
    return {"status": "logged", "total_logs": len(intervention_logs)}

@app.get("/logs", response_model=List[InterventionLog])
async def get_logs():
    return intervention_logs


# ---------------------------------------------------------------------------
# Bandit models
# ---------------------------------------------------------------------------

class BanditSelectRequest(BaseModel):
    user_id: str
    x: List[float]          # context vector, len == 12
    alpha: float = 1.0      # exploration parameter

class BanditSelectResponse(BaseModel):
    action: str
    allowed_actions: List[str]

class BanditUpdateRequest(BaseModel):
    user_id: str
    x: List[float]
    action: str
    reward: float           # Start=1.0, Not Now=0.4, Skip=0.2
    button: str             # "start" | "not_now" | "skip"
    alpha: float = 1.0


# ---------------------------------------------------------------------------
# Bandit helpers
# ---------------------------------------------------------------------------

async def _load_arm(user_id: str, action: str) -> LinUCBArm:
    """Load arm parameters from MongoDB, or return a fresh arm if not found."""
    doc = await bandit_models_collection.find_one(
        {"user_id": user_id, "action": action},
        {"_id": 0},
    )
    if doc:
        return LinUCBArm.from_dict(doc)
    return LinUCBArm()


async def _save_arm(user_id: str, action: str, arm: LinUCBArm) -> None:
    """Persist arm parameters to MongoDB (upsert)."""
    payload = arm.to_dict()
    payload["user_id"] = user_id
    payload["action"] = action
    payload["updated_at"] = time.time()
    await bandit_models_collection.update_one(
        {"user_id": user_id, "action": action},
        {"$set": payload},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Bandit endpoints
# ---------------------------------------------------------------------------

@app.post("/bandit/select", response_model=BanditSelectResponse)
async def bandit_select(req: BanditSelectRequest):
    """
    Select the best intervention for a user given their context vector.
    Filters available actions by deadline_urgency (x[11]) before scoring.
    """
    if len(req.x) != 12:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Context vector must have exactly 12 elements.")

    allowed = get_allowed_actions(req.x)
    x = np.array(req.x, dtype=float)

    # Load all allowed arms concurrently
    import asyncio
    arms_list = await asyncio.gather(*[_load_arm(req.user_id, a) for a in allowed])
    arms = dict(zip(allowed, arms_list))

    action = select_action(arms, x, req.alpha)
    return BanditSelectResponse(action=action, allowed_actions=allowed)


@app.post("/bandit/update")
async def bandit_update(req: BanditUpdateRequest):
    """
    Update the LinUCB model for a (user, action) pair after observing a reward,
    then log the full event to bandit_events.
    """
    if len(req.x) != 12:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Context vector must have exactly 12 elements.")

    if req.action not in ACTIONS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    x = np.array(req.x, dtype=float)

    arm = await _load_arm(req.user_id, req.action)
    arm.update(x, req.reward)
    await _save_arm(req.user_id, req.action, arm)

    await bandit_events_collection.insert_one({
        "user_id": req.user_id,
        "context": req.x,
        "action": req.action,
        "reward": req.reward,
        "button": req.button,
        "alpha": req.alpha,
        "n_updates_after": arm.n_updates,
        "timestamp": time.time(),
    })

    return {"status": "ok", "n_updates": arm.n_updates}


@app.get("/bandit/events")
async def bandit_events(user_id: str):
    """Return all logged bandit events for a user (most recent first)."""
    cursor = bandit_events_collection.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("timestamp", -1).limit(100)
    events = await cursor.to_list(length=100)
    return events


# ---------------------------------------------------------------------------
# Motivation history endpoints
# ---------------------------------------------------------------------------

class MotivationLogEntry(BaseModel):
    user_id: str
    motivation: float        # x[6] from the context vector, range [0, 1]
    scenario: str            # 'A' | 'B' | 'C'
    timestamp: Optional[float] = None


@app.post("/motivation/log")
async def log_motivation(entry: MotivationLogEntry):
    """Store a motivation snapshot for the user."""
    await motivation_logs_collection.insert_one({
        "user_id":    entry.user_id,
        "motivation": entry.motivation,
        "scenario":   entry.scenario,
        "timestamp":  entry.timestamp if entry.timestamp is not None else time.time(),
    })
    return {"status": "ok"}


@app.get("/motivation/history")
async def motivation_history(user_id: str, since: float = 3600.0):
    """
    Return motivation snapshots for a user within the last `since` seconds.
    Results are sorted oldest-first so the chart renders left-to-right.
    """
    cutoff = time.time() - since
    cursor = motivation_logs_collection.find(
        {"user_id": user_id, "timestamp": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("timestamp", 1).limit(500)
    data = await cursor.to_list(length=500)
    return data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)