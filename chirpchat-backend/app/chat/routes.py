
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.chat.schemas import (
    ChatCreate,
    ChatResponse,
    ChatListResponse,
    MessageCreate,
    MessageInDB,
    MessageListResponse,
    ReactionToggle,
    ChatParticipant,
    MessageStatusEnum,
    MessageSubtypeEnum,
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
        rpc_response = await db_manager.admin_client.rpc(
            'get_message_with_details', {'p_message_id': str(message_id)}
        ).maybe_single().execute()
        
        if rpc_response and rpc_response.data:
            return MessageInDB(**rpc_response.data)
        return None
    except Exception as e:
        logger.error(f"Error calling get_message_with_details RPC for message {message_id}: {e}", exc_info=True)
        return None

async def get_chat_list_for_user(user_id: UUID) -> List[ChatResponse]:
    """Helper to get a user's chat list, with last message details including sticker URL."""
    try:
        rpc_response = await db_manager.admin_client.rpc(
            'get_user_chat_list', {'p_user_id': str(user_id)}
        ).execute()
        
        if not rpc_response or not rpc_response.data:
            return []

        chat_responses = [ChatResponse.model_validate(chat_data) for chat_data in rpc_response.data]
        return chat_responses

    except Exception as e:
        logger.error(f"Error calling get_user_chat_list RPC for user {user_id}: {e}", exc_info=True)
        return []

@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_create: ChatCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    recipient_id = chat_create.recipient_id
    logger.info(f"User {current_user.id} attempting to create/get chat with recipient {recipient_id}")
    
    if not current_user.partner_id or current_user.partner_id != recipient_id:
        logger.warning(f"Chat creation denied: User {current_user.id} tried to create chat with {recipient_id}, but their partner is {current_user.partner_id}.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only create a chat with your designated partner.")

    try:
        find_chat_resp = await db_manager.admin_client.rpc(
            'find_existing_chat_with_participant_details',
            {'user1_id': str(current_user.id), 'user2_id': str(recipient_id)}
        ).maybe_single().execute()

        if find_chat_resp and find_chat_resp.data:
            logger.info(f"Found existing chat {find_chat_resp.data['id']} between {current_user.id} and {recipient_id}")
            return ChatResponse.model_validate(find_chat_resp.data)

    except Exception as e:
        logger.error(f"Error calling find_existing_chat RPC for users {current_user.id}, {recipient_id}: {e}", exc_info=True)
        pass

    logger.info(f"No existing chat found. Creating new chat between {current_user.id} and {recipient_id}.")
    new_chat_id = uuid.uuid4()
    new_chat_data = {
        "id": str(new_chat_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    new_chat_insert_resp_obj = await db_manager.get_table("chats").insert(new_chat_data).execute()
    if not new_chat_insert_resp_obj or not new_chat_insert_resp_obj.data:
        logger.error(f"Failed to create new chat entry in DB for users {current_user.id}, {recipient_id}.")
        raise HTTPException(status_code=500, detail="Failed to create chat")
    
    created_chat_data = new_chat_insert_resp_obj.data[0]
    logger.info(f"New chat entry created with ID: {created_chat_data['id']}")

    participants_to_add = [
        {"chat_id": str(created_chat_data["id"]), "user_id": str(current_user.id), "joined_at": datetime.now(timezone.utc).isoformat()},
        {"chat_id": str(created_chat_data["id"]), "user_id": str(recipient_id), "joined_at": datetime.now(timezone.utc).isoformat()}
    ]
    
    await db_manager.get_table("chat_participants").insert(participants_to_add).execute() 
    logger.info(f"Added participants to chat_participants for chat {created_chat_data['id']}")

    participant_ids_to_fetch = [current_user.id, recipient_id]
    final_participant_details = []
    for user_uuid_to_fetch in participant_ids_to_fetch:
        user_resp_obj_final = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, phone, email, is_online, last_seen, partner_id").eq("id", str(user_uuid_to_fetch)).maybe_single().execute() 
        if not user_resp_obj_final or not user_resp_obj_final.data:
             logger.error(f"Participant user details for new chat not found for ID: {user_uuid_to_fetch}")
             raise HTTPException(status_code=500, detail="Error fetching participant details for new chat.")
        final_participant_details.append(ChatParticipant(**user_resp_obj_final.data))
    
    return ChatResponse(
        id=created_chat_data["id"],
        participants=final_participant_details,
        last_message=None,
        created_at=created_chat_data["created_at"],
        updated_at=created_chat_data["updated_at"],
    )

@router.get("/", response_model=ChatListResponse)
async def list_chats(
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Listing chats for user {current_user.id} ({current_user.display_name})")
    chat_responses = await get_chat_list_for_user(current_user.id)
    
    logger.info(f"Successfully compiled {len(chat_responses)} chats for user {current_user.id}")
    return ChatListResponse(chats=chat_responses)


@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def get_messages(
    chat_id: UUID,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None,
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"User {current_user.id} requesting messages for chat {chat_id}. Limit: {limit}, Before: {before_timestamp}")
    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
        logger.warning(f"User {current_user.id} forbidden to access messages for chat {chat_id} - not a participant.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")
    
    try:
        rpc_params = {'p_chat_id': str(chat_id), 'p_limit': limit}
        if before_timestamp:
            rpc_params['p_before_timestamp'] = before_timestamp.isoformat()
        
        messages_resp = await db_manager.admin_client.rpc(
            'get_messages_for_chat', rpc_params
        ).execute()

        messages_data_list = messages_resp.data if messages_resp and messages_resp.data else []
        messages_domain_list = [MessageInDB(**m) for m in messages_data_list]
        logger.info(f"Retrieved {len(messages_domain_list)} messages for chat {chat_id} for user {current_user.id}")
        return MessageListResponse(messages=messages_domain_list)

    except Exception as e:
        logger.error(f"Error calling get_messages_for_chat RPC for chat {chat_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve messages.")
    

@router.post("/{chat_id}/messages", response_model=MessageInDB)
async def send_message_http(
    chat_id: UUID,
    message_create: MessageCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"User {current_user.id} sending HTTP message to chat {chat_id}. Payload: text='{message_create.text[:20] if message_create.text else ''}...', client_temp_id='{message_create.client_temp_id}'")
    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
        logger.warning(f"User {current_user.id} forbidden to send message to chat {chat_id} - not a participant.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    # This is a fallback endpoint. The primary logic is in ws.py.
    # We mainly need to save the message and broadcast it.
    
    processed = await ws_manager.is_message_processed(message_create.client_temp_id)
    if processed:
        logger.warning(f"HTTP: Duplicate message detected with client_temp_id: {message_create.client_temp_id}. Ignoring.")
        # We can't easily ACK here, so we just drop it. The client's resend queue should handle this.
        raise HTTPException(status_code=status.HTTP_200_OK, detail="Duplicate message, already processed.")

    message_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    
    message_data_to_insert = message_create.model_dump()
    message_data_to_insert.update({
        "id": str(message_id),
        "chat_id": str(chat_id),
        "user_id": str(current_user.id),
        "status": MessageStatusEnum.SENT_TO_SERVER.value, 
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "reactions": {},
    })
    
    insert_resp_obj = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_resp_obj or not insert_resp_obj.data:
        logger.error(f"Failed to insert message into DB for chat {chat_id} via HTTP. Payload: {message_data_to_insert}")
        raise HTTPException(status_code=500, detail="Failed to send message")
        
    await ws_manager.mark_message_as_processed(message_create.client_temp_id)

    new_message_db_id = insert_resp_obj.data[0]['id']
    logger.info(f"Message {new_message_db_id} successfully saved to DB for chat {chat_id} via HTTP.")

    await db_manager.get_table("chats").update({ "updated_at": now.isoformat() }).eq("id", str(chat_id)).execute()

    message_for_response = await get_message_with_details_from_db(new_message_db_id)
    if not message_for_response:
        raise HTTPException(status_code=500, detail="Could not retrieve message details after sending.")
    
    await ws_manager.broadcast_chat_message(str(chat_id), message_for_response)
    
    await notification_service.send_new_message_notification(
        sender=current_user,
        chat_id=chat_id,
        message=message_for_response
    )
    
    return message_for_response


@router.post("/messages/{message_id}/reactions", response_model=MessageInDB)
async def react_to_message(
    message_id: UUID,
    reaction_toggle: ReactionToggle,
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"User {current_user.id} toggling reaction '{reaction_toggle.emoji}' for message {message_id}")
    message_resp_obj = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
    if not message_resp_obj or not message_resp_obj.data:
        logger.warning(f"Message {message_id} not found for reaction by user {current_user.id}.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    message_db = message_resp_obj.data 
    chat_id_str = str(message_db["chat_id"])

    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
        logger.warning(f"User {current_user.id} forbidden to react to message {message_id} in chat {chat_id_str} - not a participant.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    reactions = message_db.get("reactions") or {}
    emoji = reaction_toggle.emoji
    user_id_str = str(current_user.id)

    if emoji not in reactions:
        reactions[emoji] = []

    if user_id_str in reactions[emoji]:
        reactions[emoji].remove(user_id_str)
        if not reactions[emoji]:
            del reactions[emoji]
        logger.debug(f"User {user_id_str} removed reaction '{emoji}' from message {message_id}. New reactions: {reactions}")
    else:
        reactions[emoji].append(user_id_str)
        logger.debug(f"User {user_id_str} added reaction '{emoji}' to message {message_id}. New reactions: {reactions}")
    
    update_reactions_resp_obj = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
    if not update_reactions_resp_obj or not update_reactions_resp_obj.data:
        logger.error(f"Failed to update reaction for message {message_id}. Payload: {reactions}")
        raise HTTPException(status_code=500, detail="Failed to update reaction")
        
    updated_message_db_id = update_reactions_resp_obj.data[0]['id']
    message_for_response = await get_message_with_details_from_db(updated_message_db_id)
    if not message_for_response:
        raise HTTPException(status_code=500, detail="Could not retrieve updated message details after reaction.")

    logger.info(f"Reaction update successful for message {message_id}. Broadcasting.")

    await ws_manager.broadcast_reaction_update(chat_id_str, message_for_response)
    
    return message_for_response
