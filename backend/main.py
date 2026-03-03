"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import db
from routers import tasks, events, tmt, interventions, app_settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    db.connect()

@app.on_event("shutdown")
async def shutdown_db_client():
    db.close()

# Include routers
app.include_router(tasks.router, prefix=f"{settings.API_V1_PREFIX}/tasks", tags=["tasks"])
app.include_router(tmt.router, prefix=f"{settings.API_V1_PREFIX}/tmt", tags=["tmt"])
app.include_router(events.router, prefix=f"{settings.API_V1_PREFIX}/events", tags=["events"])
app.include_router(interventions.router, prefix=f"{settings.API_V1_PREFIX}/interventions", tags=["interventions"])
app.include_router(app_settings.router, prefix=f"{settings.API_V1_PREFIX}/settings", tags=["settings"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Focus Task Manager API",
        "version": settings.VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
