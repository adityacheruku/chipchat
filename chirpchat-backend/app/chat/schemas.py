
from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
import enum

class ClipTypeEnum(str, enum.Enum): # Using enum.Enum for proper value access
    AUDIO = "audio"
    VIDEO = "video"

SUPPORTED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'] 
SupportedEmoji = str # Use Pydantic enum or validator for stricter check

class MessageBase(BaseModel):
    text: Optional[str] = None
    clip_type: Optional[ClipTypeEnum] = None
    clip_placeholder_text: Optional[str] = None
    clip_url: Optional[str] = None
    image_url: Optional[str] = None

class MessageCreate(MessageBase):
    recipient_id: Optional[UUID] = None
    client_temp_id: Optional[str] = None

class MessageInDB(MessageBase):
    id: UUID
    user_id: UUID
    chat_id: UUID
    created_at: datetime
    updated_at: datetime
    reactions: Optional[Dict[SupportedEmoji, List[UUID]]] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ChatParticipant(BaseModel): # Renamed from UserPublic in context of chat participant list
    id: UUID # Changed from user_id to id to match UserPublic
    display_name: str
    avatar_url: Optional[str] = None
    mood: Optional[str] = "Neutral"
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None


    class Config:
        from_attributes = True


class ChatBase(BaseModel):
    id: UUID

class ChatResponse(ChatBase):
    participants: List[ChatParticipant]
    last_message: Optional[MessageInDB] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReactionToggle(BaseModel):
    emoji: SupportedEmoji

class ChatCreate(BaseModel):
    recipient_id: UUID

class ChatListResponse(BaseModel):
    chats: List[ChatResponse]

class MessageListResponse(BaseModel):
    messages: List[MessageInDB]

class DefaultChatPartnerResponse(BaseModel):
    user_id: UUID # Kept as user_id for clarity of purpose
    display_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True
