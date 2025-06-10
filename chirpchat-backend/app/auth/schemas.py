
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

# Corresponds to ALL_MOODS in frontend types.ts
ALL_MOODS = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"]
Mood = str # Define Mood as str, validation can be done using Pydantic's enum or validator if needed stricter

class UserBase(BaseModel):
    id: UUID
    email: EmailStr # Using email as primary identifier
    display_name: str
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    phone: Optional[str] = None
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str
    # initial_avatar_url: Optional[str] = None # Will use default or be set via profile update
    # initial_mood: Optional[Mood] = "Neutral"
    # phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    mood: Optional[Mood] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None # Allow updating avatar URL directly if already uploaded

class UserPublic(BaseModel):
    id: UUID
    display_name: str
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic # Include user public info in token response for convenience

class TokenData(BaseModel):
    email: Optional[str] = None
    # sub: Optional[str] = None # 'sub' usually holds the user identifier (like email or id)
    user_id: Optional[UUID] = None
