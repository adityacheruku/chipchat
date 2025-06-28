
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re # For phone number validation

# Corresponds to ALL_MOODS in frontend types.ts
ALL_MOODS = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"]
Mood = str 

# 🔒 Security: New schemas for the multi-step OTP registration flow.

class PhoneSchema(BaseModel):
    phone: str

    @validator('phone')
    def validate_phone(cls, v):
        if not re.match(r"^\+[1-9]\d{1,14}$", v):
            raise ValueError('Phone number must be in E.164 format (e.g., +12223334444)')
        return v

class VerifyOtpRequest(PhoneSchema):
    otp: str = Field(min_length=6, max_length=6)

class VerifyOtpResponse(BaseModel):
    registration_token: str

class CompleteRegistrationRequest(BaseModel):
    registration_token: str
    display_name: str
    password: str = Field(min_length=8)
    email: Optional[EmailStr] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class UserBase(BaseModel):
    id: UUID
    phone: str # Phone number is now primary for lookups if ID not in token
    display_name: str
    email: Optional[EmailStr] = None # Email is now optional
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None
    partner_id: Optional[UUID] = None

class UserCreate(BaseModel):
    # This model is now used internally by the registration endpoint, not as a direct request body.
    phone: str
    password: str = Field(min_length=8)
    display_name: str
    email: Optional[EmailStr] = None

class UserLogin(BaseModel):
    phone: str # Changed from email
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    mood: Optional[Mood] = None
    email: Optional[EmailStr] = None # Allow updating optional email
    avatar_url: Optional[str] = None

class UserPublic(BaseModel):
    id: UUID
    display_name: str
    avatar_url: Optional[str] = None
    mood: Optional[Mood] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    partner_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic

class TokenData(BaseModel):
    phone: Optional[str] = None
    user_id: Optional[UUID] = None
    token_type: Optional[str] = None

    