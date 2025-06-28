
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    HUGGINGFACE_API_KEY: Optional[str] = None
    HUGGINGFACE_MOOD_MODEL_URL: Optional[str] = None
    NOTIFICATION_EMAIL_TO: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_SENDER_EMAIL: Optional[str] = None
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_ADMIN_EMAIL: Optional[str] = "mailto:admin@example.com"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SERVER_INSTANCE_ID: str = "default-instance-01"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
