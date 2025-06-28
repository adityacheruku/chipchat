
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.chat.schemas import (
    ChatCreate, ChatResponse, ChatListResponse, MessageCreate, MessageInDB,
    MessageListResponse, ReactionToggle, ChatParticipant, MessageStatusEnum,
    MessageModeEnum
)
from app.auth.dependencies import get_current_active_user, get_current_user
from app.auth.schemas import UserPublic
from app.database import db_manager
from app.websocket import manager as ws_manager
from app.utils.logging import logger 
from app.notifications.service import notification_service
import uuid

router = APIRouter(prefix="/chats", tags=["Chats"])

async def get_message_with_details_from_db(message_id: UUID) -> Optional[MessageInDB]:
    """Helper function to fetch a message and join its sticker details."""
    try:
        response = await db_manager.get_table("messages").select("*, stickers(image_url)").eq("id", str(message_id)).maybe_single().execute()
        if not response.data: return None
        
        message_data = response.data
        if message_data.get("stickers"):
            message_data["sticker_image_url"] = message_data["stickers"].get("image_url")
            del message_data["stickers"]
        return MessageInDB(**message_data)
    except Exception as e:
        logger.error(f"Error getting message with details from DB for message {message_id}: {e}", exc_info=True)
        return None

async def get_chat_list_for_user(user_id: UUID) -> List[ChatResponse]:
    try:
        rpc_response = await db_manager.admin_client.rpc('get_user_chat_list', {'p_user_id': str(user_id)}).execute()
        if not rpc_response.data: return []
        return [ChatResponse.model_validate(chat_data) for chat_data in rpc_response.data]
    except Exception as e:
        logger.error(f"Error calling get_user_chat_list RPC for user {user_id}: {e}", exc_info=True)
        return []

@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    chat_id: UUID,
    current_user: UserPublic = Depends(get_current_user),
):
    logger.info(f"User {current_user.id} attempting to delete message {message_id} from chat {chat_id}")

    # Verify user is the sender of the message
    msg_resp = await db_manager.get_table("messages").select("user_id, chat_id").eq("id", str(message_id)).single().execute()
    if not msg_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if str(msg_resp.data["user_id"]) != str(current_user.id) or str(msg_resp.data["chat_id"]) != str(chat_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own messages.")

    # Perform deletion
    await db_manager.get_table("messages").delete().eq("id", str(message_id)).execute()

    # Broadcast deletion event
    await ws_manager.broadcast_message_deletion(str(chat_id), str(message_id))
    
    return None

@router.post("/", response_model=ChatResponse)
async def create_chat(chat_create: ChatCreate, current_user: UserPublic = Depends(get_current_active_user)):
    recipient_id = chat_create.recipient_id
    if not current_user.partner_id or current_user.partner_id != recipient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only create a chat with your designated partner.")

    try:
        find_chat_resp = await db_manager.admin_client.rpc('find_existing_chat_with_participant_details', {'user1_id': str(current_user.id), 'user2_id': str(recipient_id)}).maybe_single().execute()
        if find_chat_resp.data:
            return ChatResponse.model_validate(find_chat_resp.data)
    except Exception as e:
        logger.error(f"Error calling find_existing_chat RPC: {e}", exc_info=True)

    new_chat_id = uuid.uuid4()
    new_chat_data = {"id": str(new_chat_id), "created_at": "now()", "updated_at": "now()"}
    db_manager.get_table("chats").insert(new_chat_data).execute()
    
    participants_to_add = [
        {"chat_id": str(new_chat_id), "user_id": str(current_user.id), "joined_at": "now()"},
        {"chat_id": str(new_chat_id), "user_id": str(recipient_id), "joined_at": "now()"}
    ]
    db_manager.get_table("chat_participants").insert(participants_to_add).execute()

    find_chat_resp = await db_manager.admin_client.rpc('find_existing_chat_with_participant_details', {'user1_id': str(current_user.id), 'user2_id': str(recipient_id)}).maybe_single().execute()
    if not find_chat_resp.data:
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created chat.")
    return ChatResponse.model_validate(find_chat_resp.data)

@router.get("/", response_model=ChatListResponse)
async def list_chats(current_user: UserPublic = Depends(get_current_active_user)):
    chat_responses = await get_chat_list_for_user(current_user.id)
    return ChatListResponse(chats=chat_responses)

@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def get_messages(chat_id: UUID, limit: int = 50, before_timestamp: Optional[datetime] = None, current_user: UserPublic = Depends(get_current_active_user)):
    is_participant_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not is_participant_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")
    
    query = db_manager.get_table("messages").select("*, stickers(image_url)").eq("chat_id", str(chat_id)).order("created_at", desc=True).limit(limit)
    if before_timestamp:
        query = query.lt("created_at", before_timestamp.isoformat())
    
    messages_resp = await query.execute()
    
    messages_data_list = messages_resp.data or []
    cleaned_messages = []
    for m in reversed(messages_data_list):
        if m.get("stickers"):
            m["sticker_image_url"] = m["stickers"].get("image_url")
            del m["stickers"]
        cleaned_messages.append(m)
        
    return MessageListResponse(messages=[MessageInDB(**m) for m in cleaned_messages])

@router.post("/{chat_id}/messages", response_model=MessageInDB)
async def send_message_http(chat_id: UUID, message_create: MessageCreate, current_user: UserPublic = Depends(get_current_active_user)):
    is_participant_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not is_participant_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    if await ws_manager.is_message_processed(message_create.client_temp_id):
        raise HTTPException(status_code=status.HTTP_200_OK, detail="Duplicate message, already processed.")

    message_id = uuid.uuid4()
    
    if message_create.mode == MessageModeEnum.INCOGNITO:
        incognito_message_obj = MessageInDB(id=message_id, chat_id=chat_id, user_id=current_user.id, **message_create.model_dump(), status=MessageStatusEnum.SENT, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc), reactions={})
        await ws_manager.mark_message_as_processed(message_create.client_temp_id)
        await ws_manager.broadcast_chat_message(str(chat_id), incognito_message_obj)
        return incognito_message_obj

    message_data_to_insert = message_create.model_dump()
    message_data_to_insert.update({
        "id": str(message_id), "chat_id": str(chat_id), "user_id": str(current_user.id),
        "status": MessageStatusEnum.SENT.value, "mode": message_create.mode.value if message_create.mode else MessageModeEnum.NORMAL.value,
        "created_at": "now()", "updated_at": "now()", "reactions": {},
    })
    
    insert_resp_obj = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_resp_obj.data:
        raise HTTPException(status_code=500, detail="Failed to send message")
        
    await ws_manager.mark_message_as_processed(message_create.client_temp_id)
    await db_manager.get_table("chats").update({"updated_at": "now()"}).eq("id", str(chat_id)).execute()

    message_for_response = await get_message_with_details_from_db(message_id)
    if not message_for_response:
        raise HTTPException(status_code=500, detail="Could not retrieve message details after sending.")
    
    await ws_manager.broadcast_chat_message(str(chat_id), message_for_response)
    await notification_service.send_new_message_notification(sender=current_user, chat_id=chat_id, message=message_for_response)
    
    return message_for_response

@router.post("/messages/{message_id}/reactions", response_model=MessageInDB)
async def react_to_message(message_id: UUID, reaction_toggle: ReactionToggle, current_user: UserPublic = Depends(get_current_active_user)):
    message_resp_obj = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
    if not message_resp_obj.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    message_db = message_resp_obj.data 
    chat_id_str = str(message_db["chat_id"])
    if message_db.get("mode") == MessageModeEnum.INCOGNITO.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot react to incognito messages.")

    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    reactions = message_db.get("reactions") or {}
    emoji = reaction_toggle.emoji
    user_id_str = str(current_user.id)
    if emoji not in reactions: reactions[emoji] = []
    if user_id_str in reactions[emoji]:
        reactions[emoji].remove(user_id_str)
        if not reactions[emoji]: del reactions[emoji]
    else:
        reactions[emoji].append(user_id_str)
    
    await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": "now()"}).eq("id", str(message_id)).execute()
        
    message_for_response = await get_message_with_details_from_db(message_id)
    if not message_for_response:
        raise HTTPException(status_code=500, detail="Could not retrieve updated message details after reaction.")

    await ws_manager.broadcast_reaction_update(chat_id_str, message_for_response)
    return message_for_response
