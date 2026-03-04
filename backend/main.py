from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import time

app = FastAPI(title="Intervention API")

# Configure CORS for Electron/Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InterventionLog(BaseModel):
    strategy: str
    action: str  # 'accept', 'reject', 'complete'
    timestamp: float = time.time()

class Strategy(BaseModel):
    id: str
    title: str
    description: str

# Mock database
intervention_logs = []
strategies = [
    Strategy(id="pomodoro", title="Pomodoro Timer", description="Focus for 25 minutes, then take a 5-minute break."),
    Strategy(id="5_second_rule", title="5-Second Rule", description="Count down 5-4-3-2-1 and physically move to start your task."),
    Strategy(id="breathing", title="Breathing Exercise", description="Take a moment to calm your mind with guided breathing."),
]

@app.get("/")
async def root():
    return {"message": "Intervention Backend is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

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
