
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

    recipient_user_resp = await db_manager.get_table("users").select("id").eq("id", str(recipient_id)).maybe_single().execute()
    if not recipient_user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found")

    # Find existing 2-person chat between current_user and recipient
    # Query chat_participants for chats involving current_user
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    user_chat_ids = [row["chat_id"] for row in user_chats_resp.data]

    if user_chat_ids:
        for chat_id_uuid_val in user_chat_ids:
            chat_id_str = str(chat_id_uuid_val)
            participants_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).execute()
            participant_ids_in_chat = [UUID(str(row["user_id"])) for row in participants_resp.data] # Cast to UUID
            
            # Ensure it's a 2-person chat AND the other participant is the recipient
            if len(participant_ids_in_chat) == 2 and recipient_id in participant_ids_in_chat:
                chat_detail_resp = await db_manager.get_table("chats").select("*").eq("id", chat_id_str).single().execute()
                chat_data = chat_detail_resp.data
                
                participant_details_list = []
                for p_id_uuid in participant_ids_in_chat:
                    user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(p_id_uuid)).single().execute()
                    participant_details_list.append(ChatParticipant(**user_resp.data))
                
                last_msg_resp = await db_manager.get_table("messages").select("*").eq("chat_id", chat_id_str).order("created_at", desc=True).limit(1).maybe_single().execute()
                last_message = MessageInDB(**last_msg_resp.data) if last_msg_resp.data else None

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
    new_chat_insert_resp = await db_manager.get_table("chats").insert(new_chat_data).execute()
    if not new_chat_insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create chat")
    
    created_chat_data = new_chat_insert_resp.data[0]

    participants_to_add = [
        {"chat_id": str(created_chat_data["id"]), "user_id": str(current_user.id), "joined_at": datetime.now(timezone.utc).isoformat()},
        {"chat_id": str(created_chat_data["id"]), "user_id": str(recipient_id), "joined_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db_manager.get_table("chat_participants").insert(participants_to_add).execute()

    final_participant_details = []
    for user_uuid_to_fetch in [current_user.id, recipient_id]:
        user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(user_uuid_to_fetch)).single().execute()
        final_participant_details.append(ChatParticipant(**user_resp.data))
    
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
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    user_chat_ids = list(set([row["chat_id"] for row in user_chats_resp.data]))

    chat_responses = []
    for chat_id_uuid_val in user_chat_ids:
        chat_id_str = str(chat_id_uuid_val)
        chat_detail_resp = await db_manager.get_table("chats").select("*").eq("id", chat_id_str).maybe_single().execute()
        if not chat_detail_resp.data:
            continue
        
        chat_data = chat_detail_resp.data
        
        participants_in_chat_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).execute()
        participant_ids_in_chat = [UUID(str(row["user_id"])) for row in participants_in_chat_resp.data] # Cast to UUID
        
        participant_details_list = []
        for p_id_uuid in participant_ids_in_chat:
            user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(p_id_uuid)).single().execute()
            participant_details_list.append(ChatParticipant(**user_resp.data))
        
        last_msg_resp = await db_manager.get_table("messages").select("*").eq("chat_id", chat_id_str).order("created_at", desc=True).limit(1).maybe_single().execute()
        last_message = MessageInDB(**last_msg_resp.data) if last_msg_resp.data else None
        
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
    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    query = db_manager.get_table("messages").select("*").eq("chat_id", str(chat_id))
    if before_timestamp:
        query = query.lt("created_at", before_timestamp.isoformat())
    
    messages_resp = await query.order("created_at", desc=True).limit(limit).execute()
    
    messages_data = [MessageInDB(**m) for m in messages_resp.data] if messages_resp.data else []
    return MessageListResponse(messages=messages_data)

@router.post("/{chat_id}/messages", response_model=MessageInDB)
async def send_message_http(
    chat_id: UUID,
    message_create: MessageCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
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
    
    insert_resp = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to send message")
        
    new_message_db = insert_resp.data[0]

    await db_manager.get_table("chats").update({
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
    message_resp = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
    if not message_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    message_db = message_resp.data
    chat_id_str = str(message_db["chat_id"])

    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
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
    
    update_reactions_resp = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
    if not update_reactions_resp.data:
        raise HTTPException(status_code=500, detail="Failed to update reaction")
        
    updated_message_db = update_reactions_resp.data[0]
    message_for_response = MessageInDB(**updated_message_db)

    await manager.broadcast_reaction_update(chat_id_str, message_for_response, db_manager)
    
    return message_for_response


@router.get("/me/default-chat-partner", response_model=Optional[DefaultChatPartnerResponse])
async def get_default_chat_partner(
    current_user: UserPublic = Depends(get_current_active_user),
):
    try:
        logger.info(f"Fetching default chat partner for user: {current_user.id} ({current_user.display_name})")
        
        all_users_resp = await db_manager.get_table("users").select("id, display_name, avatar_url, mood, is_online, last_seen").execute()
        
        if not all_users_resp.data:
            logger.warning(f"No users found in the database when fetching default chat partner for {current_user.id}.")
            return None

        logger.info(f"Found {len(all_users_resp.data)} users in total.")

        # Filter out the current user to find the other partner(s)
        other_partners_data = [
            user_data for user_data in all_users_resp.data 
            if UUID(user_data["id"]) != current_user.id
        ]

        if not other_partners_data:
            logger.warning(f"No other users found for {current_user.id} to be a default chat partner.")
            return None
        
        # In a 2-user system, there should be exactly one other partner.
        # If more than one, this simplified logic just picks the first one.
        # For a multi-user system, the concept of a "default" partner would need re-evaluation.
        default_partner_data = other_partners_data[0]
        logger.info(f"Default chat partner found for {current_user.id}: {default_partner_data['id']} ({default_partner_data['display_name']})")
        
        return DefaultChatPartnerResponse(
            user_id=default_partner_data["id"],
            display_name=default_partner_data["display_name"],
            avatar_url=default_partner_data["avatar_url"]
        )
    except Exception as e:
        logger.error(f"Error in get_default_chat_partner for user {current_user.id}: {str(e)}", exc_info=True)
        # Log the full traceback with exc_info=True
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not determine default chat partner.")

