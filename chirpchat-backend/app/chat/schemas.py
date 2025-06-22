from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
import enum

class ClipTypeEnum(str, enum.Enum): # Using enum.Enum for proper value access
    AUDIO = "audio"
    VIDEO = "video"

class MessageSubtypeEnum(str, enum.Enum):
    TEXT = "text"
    STICKER = "sticker"
    CLIP = "clip"
    IMAGE = "image"
    DOCUMENT = "document"
    VOICE_MESSAGE = "voice_message"
    EMOJI_ONLY = "emoji_only"

SUPPORTED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '🤔', '💯'] 
SupportedEmoji = str # Use Pydantic enum or validator for stricter check

class MessageStatusEnum(str, enum.Enum):
    SENDING = "sending" # Client-side status before server confirmation
    SENT_TO_SERVER = "sent_to_server" # Server has persisted it
    DELIVERED_TO_RECIPIENT = "delivered_to_recipient" # Future: Confirmed delivery to recipient's device
    READ_BY_RECIPIENT = "read_by_recipient" # Future: Confirmed read by recipient
    FAILED = "failed" # If sending failed

class MessageBase(BaseModel):
    text: Optional[str] = None
    message_subtype: Optional[MessageSubtypeEnum] = MessageSubtypeEnum.TEXT
    
    # Sticker fields - now just sticker_id
    sticker_id: Optional[UUID] = None
    
    # Media clip fields
    clip_type: Optional[ClipTypeEnum] = None
    clip_placeholder_text: Optional[str] = None
    clip_url: Optional[str] = None
    # Image fields
    image_url: Optional[str] = None
    image_thumbnail_url: Optional[str] = None # For optimized image loading
    # Document fields
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    # Voice message metadata
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    audio_format: Optional[str] = None
    transcription: Optional[str] = None


class MessageCreate(MessageBase):
    chat_id: Optional[UUID] = None # Added for WebSocket payload validation
    recipient_id: Optional[UUID] = None # For HTTP creation, if directly targeting a user to start a chat
    client_temp_id: Optional[str] = None # Client-generated temporary ID for deduplication and optimistic UI

class MessageInDB(MessageBase):
    id: UUID
    user_id: UUID
    chat_id: UUID
    created_at: datetime
    updated_at: datetime
    reactions: Optional[Dict[SupportedEmoji, List[UUID]]] = Field(default_factory=dict)
    status: Optional[MessageStatusEnum] = MessageStatusEnum.SENT_TO_SERVER # Default status when fetched/created by server
    client_temp_id: Optional[str] = None # Store the client's temporary ID

    # To show stickers in chat list, we need to join and get the URL
    sticker_image_url: Optional[str] = None

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
