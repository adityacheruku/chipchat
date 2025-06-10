
from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
# Removed direct import of ClipTypeEnum from models if that file is mostly empty.
# Define ClipTypeEnum here or import from a common types file.
class ClipTypeEnum(str): # Simplified for schema definition, validation can be added
    audio = "audio"
    video = "video"

# Ensure SupportedEmoji matches frontend/types.ts
SUPPORTED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'] # Keep in sync with frontend
SupportedEmoji = str # Use Pydantic enum or validator for stricter check

class MessageBase(BaseModel):
    text: Optional[str] = None
    clip_type: Optional[ClipTypeEnum] = None
    clip_placeholder_text: Optional[str] = None
    clip_url: Optional[str] = None
    image_url: Optional[str] = None

class MessageCreate(MessageBase):
    # chat_id is usually part of the path for POST /chats/{chat_id}/messages
    # recipient_id is used if creating a message should also find/create a chat
    recipient_id: Optional[UUID] = None # If sending to a user directly to find/create chat
    client_temp_id: Optional[str] = None # For client-side message tracking before DB ID

class MessageInDB(MessageBase):
    id: UUID
    user_id: UUID # Sender's ID
    chat_id: UUID
    created_at: datetime # Renamed from timestamp for consistency
    updated_at: datetime
    reactions: Optional[Dict[SupportedEmoji, List[UUID]]] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ChatParticipant(BaseModel):
    user_id: UUID
    display_name: str # Renamed from name
    avatar_url: Optional[str] = None
    # mood: Optional[str] = None # Can be added if needed in participant list

    class Config:
        from_attributes = True


class ChatBase(BaseModel):
    id: UUID

class ChatResponse(ChatBase): # Renamed from Chat for clarity as API response
    participants: List[ChatParticipant]
    last_message: Optional[MessageInDB] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReactionToggle(BaseModel):
    emoji: SupportedEmoji # Ensure this matches an emoji from SUPPORTED_EMOJIS

class ChatCreate(BaseModel):
    recipient_id: UUID # To create a chat with this user

class ChatListResponse(BaseModel):
    chats: List[ChatResponse]

class MessageListResponse(BaseModel):
    messages: List[MessageInDB]

class DefaultChatPartnerResponse(BaseModel):
    user_id: UUID
    display_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True
