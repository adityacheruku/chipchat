
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
    DefaultChatPartnerResponse,
)
from app.auth.dependencies import get_current_active_user, get_current_user
from app.auth.schemas import UserPublic
from app.database import db_manager
from app.websocket.manager import manager
from app.utils.logging import logger # Ensure logger is imported
import uuid # For new message_id

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_create: ChatCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    recipient_id = chat_create.recipient_id
    if recipient_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create chat with yourself")

    recipient_user_resp_obj = await db_manager.get_table("users").select("id").eq("id", str(recipient_id)).maybe_single().execute()
    if not recipient_user_resp_obj or not recipient_user_resp_obj.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found")

    # Find existing 2-person chat between current_user and recipient
    # Query chat_participants for chats involving current_user
    user_chats_resp_obj = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    if not user_chats_resp_obj or not user_chats_resp_obj.data:
        user_chat_ids = []
    else:
        user_chat_ids = [row["chat_id"] for row in user_chats_resp_obj.data]


    if user_chat_ids:
        for chat_id_uuid_val in user_chat_ids:
            chat_id_str = str(chat_id_uuid_val)
            participants_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).execute()
            if not participants_resp_obj or not participants_resp_obj.data:
                continue # Should not happen if chat_id came from user_chats
            
            participant_ids_in_chat = [UUID(str(row["user_id"])) for row in participants_resp_obj.data] 
            
            if len(participant_ids_in_chat) == 2 and recipient_id in participant_ids_in_chat:
                chat_detail_resp_obj = await db_manager.get_table("chats").select("*").eq("id", chat_id_str).single().execute()
                if not chat_detail_resp_obj or not chat_detail_resp_obj.data: # single() should error if not found or raise PostgrestAPIError for other issues
                    logger.error(f"Chat details not found for presumably existing chat ID: {chat_id_str}")
                    continue # Or raise 500

                chat_data = chat_detail_resp_obj.data
                
                participant_details_list = []
                for p_id_uuid in participant_ids_in_chat:
                    user_resp_obj_inner = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(p_id_uuid)).single().execute()
                    if not user_resp_obj_inner or not user_resp_obj_inner.data:
                         logger.error(f"Participant user details not found for ID: {p_id_uuid} in chat {chat_id_str}")
                         continue # Or raise 500 / skip this chat if inconsistent
                    participant_details_list.append(ChatParticipant(**user_resp_obj_inner.data))
                
                last_msg_resp_obj = await db_manager.get_table("messages").select("*").eq("chat_id", chat_id_str).order("created_at", desc=True).limit(1).maybe_single().execute()
                last_message_data = last_msg_resp_obj.data if last_msg_resp_obj else None
                last_message = MessageInDB(**last_message_data) if last_message_data else None

                return ChatResponse(
                    id=chat_data["id"],
                    participants=participant_details_list,
                    last_message=last_message,
                    created_at=chat_data["created_at"],
                    updated_at=chat_data["updated_at"],
                )

    # Create new chat
    new_chat_id = uuid.uuid4()
    new_chat_data = {
        "id": str(new_chat_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    new_chat_insert_resp_obj = await db_manager.get_table("chats").insert(new_chat_data).execute()
    if not new_chat_insert_resp_obj or not new_chat_insert_resp_obj.data:
        raise HTTPException(status_code=500, detail="Failed to create chat")
    
    created_chat_data = new_chat_insert_resp_obj.data[0]

    participants_to_add = [
        {"chat_id": str(created_chat_data["id"]), "user_id": str(current_user.id), "joined_at": datetime.now(timezone.utc).isoformat()},
        {"chat_id": str(created_chat_data["id"]), "user_id": str(recipient_id), "joined_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db_manager.get_table("chat_participants").insert(participants_to_add).execute() # Assume this is fine or add error check

    final_participant_details = []
    for user_uuid_to_fetch in [current_user.id, recipient_id]:
        user_resp_obj_final = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(user_uuid_to_fetch)).single().execute()
        if not user_resp_obj_final or not user_resp_obj_final.data:
             logger.error(f"Participant user details for new chat not found for ID: {user_uuid_to_fetch}")
             # This would indicate a serious issue if users just involved in creation aren't found
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
    user_chats_resp_obj = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    if not user_chats_resp_obj or not user_chats_resp_obj.data:
        user_chat_ids = []
    else:
        user_chat_ids = list(set([row["chat_id"] for row in user_chats_resp_obj.data]))

    chat_responses = []
    for chat_id_uuid_val in user_chat_ids:
        chat_id_str = str(chat_id_uuid_val)
        chat_detail_resp_obj = await db_manager.get_table("chats").select("*").eq("id", chat_id_str).maybe_single().execute()
        if not chat_detail_resp_obj or not chat_detail_resp_obj.data:
            logger.warning(f"Chat details not found for chat ID: {chat_id_str} during list_chats for user {current_user.id}. Skipping.")
            continue
        
        chat_data = chat_detail_resp_obj.data
        
        participants_in_chat_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).execute()
        if not participants_in_chat_resp_obj or not participants_in_chat_resp_obj.data:
            logger.warning(f"No participants found for chat ID: {chat_id_str} during list_chats. Skipping.")
            continue # Should not happen if chat_id came from user_chats

        participant_ids_in_chat = [UUID(str(row["user_id"])) for row in participants_in_chat_resp_obj.data] 
        
        participant_details_list = []
        valid_chat = True
        for p_id_uuid in participant_ids_in_chat:
            user_resp_obj_list = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(p_id_uuid)).single().execute()
            if not user_resp_obj_list or not user_resp_obj_list.data:
                logger.error(f"Participant user details not found for ID: {p_id_uuid} in chat {chat_id_str} during list_chats. Skipping chat.")
                valid_chat = False
                break
            participant_details_list.append(ChatParticipant(**user_resp_obj_list.data))
        
        if not valid_chat:
            continue

        last_msg_resp_obj = await db_manager.get_table("messages").select("*").eq("chat_id", chat_id_str).order("created_at", desc=True).limit(1).maybe_single().execute()
        last_message_data = last_msg_resp_obj.data if last_msg_resp_obj else None
        last_message = MessageInDB(**last_message_data) if last_message_data else None
        
        chat_responses.append(
            ChatResponse(
                id=chat_data["id"],
                participants=participant_details_list,
                last_message=last_message,
                created_at=chat_data["created_at"],
                updated_at=chat_data["updated_at"],
            )
        )
    chat_responses.sort(key=lambda c: (c.last_message.created_at if c.last_message else c.created_at), reverse=True)
    return ChatListResponse(chats=chat_responses)


@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def get_messages(
    chat_id: UUID,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None,
    current_user: UserPublic = Depends(get_current_active_user),
):
    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    query = db_manager.get_table("messages").select("*").eq("chat_id", str(chat_id))
    if before_timestamp:
        query = query.lt("created_at", before_timestamp.isoformat())
    
    messages_resp_obj = await query.order("created_at", desc=True).limit(limit).execute()
    
    messages_data_list = messages_resp_obj.data if messages_resp_obj and messages_resp_obj.data else []
    messages_domain_list = [MessageInDB(**m) for m in messages_data_list]
    return MessageListResponse(messages=messages_domain_list)

@router.post("/{chat_id}/messages", response_model=MessageInDB)
async def send_message_http(
    chat_id: UUID,
    message_create: MessageCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    message_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    
    message_data_to_insert = {
        "id": str(message_id),
        "chat_id": str(chat_id),
        "user_id": str(current_user.id),
        "text": message_create.text,
        "clip_type": message_create.clip_type.value if message_create.clip_type else None,
        "clip_placeholder_text": message_create.clip_placeholder_text,
        "clip_url": message_create.clip_url,
        "image_url": message_create.image_url,
        "client_temp_id": message_create.client_temp_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "reactions": {},
    }
    
    insert_resp_obj = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_resp_obj or not insert_resp_obj.data:
        raise HTTPException(status_code=500, detail="Failed to send message")
        
    new_message_db = insert_resp_obj.data[0]

    await db_manager.get_table("chats").update({ # Assume this is fine or add error check
        "updated_at": now.isoformat(),
    }).eq("id", str(chat_id)).execute()

    message_for_response = MessageInDB(**new_message_db)
    
    await manager.broadcast_chat_message(str(chat_id), message_for_response, db_manager)
    
    return message_for_response


@router.post("/messages/{message_id}/reactions", response_model=MessageInDB)
async def react_to_message(
    message_id: UUID,
    reaction_toggle: ReactionToggle,
    current_user: UserPublic = Depends(get_current_active_user),
):
    message_resp_obj = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
    if not message_resp_obj or not message_resp_obj.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    message_db = message_resp_obj.data # This is the dictionary
    chat_id_str = str(message_db["chat_id"])

    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp_obj or not participant_check_resp_obj.data:
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
    else:
        reactions[emoji].append(user_id_str)
    
    update_reactions_resp_obj = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
    if not update_reactions_resp_obj or not update_reactions_resp_obj.data:
        raise HTTPException(status_code=500, detail="Failed to update reaction")
        
    updated_message_db = update_reactions_resp_obj.data[0]
    message_for_response = MessageInDB(**updated_message_db)

    await manager.broadcast_reaction_update(chat_id_str, message_for_response, db_manager)
    
    return message_for_response


@router.get("/me/default-chat-partner", response_model=Optional[DefaultChatPartnerResponse])
async def get_default_chat_partner(
    current_user: UserPublic = Depends(get_current_active_user),
):
    try:
        logger.info(f"Fetching default chat partner for user: {current_user.id} ({current_user.display_name})")
        
        all_users_resp_obj = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").execute()
        
        if not all_users_resp_obj or not all_users_resp_obj.data: 
            logger.warning(f"No users found in the database (or DB response error) when fetching default chat partner for {current_user.id}.")
            return None

        logger.info(f"Found {len(all_users_resp_obj.data)} users in total.")

        other_partners_data = [
            user_data for user_data in all_users_resp_obj.data 
            if UUID(user_data["id"]) != current_user.id
        ]

        if not other_partners_data:
            logger.warning(f"No other users found for {current_user.id} to be a default chat partner.")
            return None
        
        default_partner_data = other_partners_data[0]
        logger.info(f"Default chat partner found for {current_user.id}: {default_partner_data['id']} ({default_partner_data['display_name']})")
        
        return DefaultChatPartnerResponse(
            user_id=default_partner_data["id"],
            display_name=default_partner_data["display_name"],
            avatar_url=default_partner_data["avatar_url"]
        )
    except Exception as e:
        logger.error(f"Error in get_default_chat_partner for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not determine default chat partner.")


    