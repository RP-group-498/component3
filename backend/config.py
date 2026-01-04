"""
Configuration settings for the FastAPI backend
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Focus Task Manager API"
    VERSION: str = "1.0.0"
    
    # CORS Settings
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
        "file://*",  # Allow Electron app
    ]
    
    # Server Settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Database Settings
    MONGODB_URL: str = "mongodb+srv://it22202468_db_user:MoSalah10@focus.dj52z6r.mongodb.net/?appName=Focus"
    MONGODB_DB_NAME: str = "focus"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
