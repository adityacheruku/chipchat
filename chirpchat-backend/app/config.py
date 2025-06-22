
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # Redis for WebSocket scaling
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 # Default to 30 minutes
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    
    # AI
    HUGGINGFACE_API_KEY: Optional[str] = None # Optional if not used
    HUGGINGFACE_MOOD_MODEL_URL: Optional[str] = None # Optional

    # Email Notifications
    NOTIFICATION_EMAIL_TO: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_SENDER_EMAIL: Optional[str] = None
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    
    # Push Notifications (VAPID)
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_ADMIN_EMAIL: Optional[str] = "mailto:admin@example.com"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SERVER_INSTANCE_ID: str = "default-instance-01" # Should be unique per instance in production
    
    class Config:
        env_file = ".env"
        extra = "ignore" # Ignore extra fields from .env

settings = Settings()
