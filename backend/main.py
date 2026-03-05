from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import time
import motor.motor_asyncio

app = FastAPI(title="Intervention API")

# MongoDB connection
MONGO_DETAILS = "mongodb+srv://it22202468_db_user:H9uZ19ILa07S8Hqh@focusapp.plzzdeo.mongodb.net/"
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client.intervention_db
user_collection = database.get_collection("User")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)