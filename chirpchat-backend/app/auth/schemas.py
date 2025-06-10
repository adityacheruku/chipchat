
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re # For phone number validation

# Corresponds to ALL_MOODS in frontend types.ts
ALL_MOODS = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"]
Mood = str 

class UserBase(BaseModel):
    id: UUID
    phone: str # Phone number is now primary for lookups if ID not in token
    display_name: str
    email: Optional[EmailStr] = None # Email is now optional
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None

class UserCreate(BaseModel):
    phone: str
    password: str = Field(min_length=8)
    display_name: str
    email: Optional[EmailStr] = None # Optional email during registration
    # initial_mood: Optional[Mood] = "Neutral" # Defaulted in route

    @validator('phone')
    def validate_phone(cls, v):
        # Basic phone validation (e.g., E.164 format, or adjust to your needs)
        # This is a simple example, consider using a more robust library for production
        if not re.match(r"^\+[1-9]\d{1,14}$", v): # Example: +12223334444
            raise ValueError('Phone number must be in E.164 format (e.g., +12223334444)')
        return v

class UserLogin(BaseModel):
    phone: str # Changed from email
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    mood: Optional[Mood] = None
    email: Optional[EmailStr] = None # Allow updating optional email
    # Phone number update should ideally be a separate, verified process. Not included here for simplicity.
    avatar_url: Optional[str] = None

class UserPublic(BaseModel):
    id: UUID
    display_name: str
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None
    phone: Optional[str] = None # Include phone in public for display if needed (e.g. in ChatHeader if desired)
    email: Optional[EmailStr] = None # Include optional email if needed

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

class TokenData(BaseModel):
    phone: Optional[str] = None # Changed from email to phone
    user_id: Optional[UUID] = None

