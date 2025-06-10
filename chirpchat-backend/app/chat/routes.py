
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
from app.auth.dependencies import get_current_active_user # Changed to get_current_active_user
from app.auth.schemas import UserPublic # To type current_user
from app.database import db_manager
from app.websocket.manager import manager

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_create: ChatCreate,
    current_user: UserPublic = Depends(get_current_active_user),
):
    recipient_id = chat_create.recipient_id
    if recipient_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create chat with yourself")

    # Check if recipient exists
    recipient_user_resp = await db_manager.get_table("users").select("id").eq("id", str(recipient_id)).maybe_single().execute()
    if not recipient_user_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found")

    # Find existing 2-person chat between current_user and recipient
    # This query needs to be more specific to find chats with *only* these two participants.
    # A more robust way is to query chat_participants for chats involving current_user,
    # then for each of those chats, check if recipient_id is the *only other* participant.
    
    # Simplified check: find chats current_user is in
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    user_chat_ids = [row["chat_id"] for row in user_chats_resp.data]

    if user_chat_ids:
        # For each chat_id, get all its participants
        for chat_id_uuid in user_chat_ids:
            chat_id = str(chat_id_uuid)
            participants_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            participant_ids_in_chat = [row["user_id"] for row in participants_resp.data]
            
            # Check if it's a 2-person chat with the recipient
            if len(participant_ids_in_chat) == 2 and recipient_id in participant_ids_in_chat:
                # Found existing chat, fetch its details
                chat_detail_resp = await db_manager.get_table("chats").select("*").eq("id", chat_id).single().execute()
                chat_data = chat_detail_resp.data
                
                participant_details_list = []
                for p_id_uuid in participant_ids_in_chat:
                    p_id = str(p_id_uuid)
                    user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url").eq("id", p_id).single().execute()
                    participant_details_list.append(ChatParticipant(**user_resp.data))
                
                # Fetch last message for this existing chat
                last_msg_resp = await db_manager.get_table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=True).limit(1).maybe_single().execute()
                last_message = MessageInDB(**last_msg_resp.data) if last_msg_resp.data else None

                return ChatResponse(
                    id=chat_data["id"],
                    participants=participant_details_list,
                    last_message=last_message,
                    created_at=chat_data["created_at"],
                    updated_at=chat_data["updated_at"],
                )

    # Create new chat
    new_chat_id = UUID(db_manager.client.rpc('uuid_generate_v4', {}).execute().data) # Generate UUID via Supabase function or Python uuid4
    
    new_chat_data = {
        "id": str(new_chat_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    new_chat_insert_resp = await db_manager.get_table("chats").insert(new_chat_data).execute()
    if not new_chat_insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create chat")
    
    created_chat_data = new_chat_insert_resp.data[0]

    # Add participants
    participants_to_add = [
        {"chat_id": str(created_chat_data["id"]), "user_id": str(current_user.id), "joined_at": datetime.now(timezone.utc).isoformat()},
        {"chat_id": str(created_chat_data["id"]), "user_id": str(recipient_id), "joined_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db_manager.get_table("chat_participants").insert(participants_to_add).execute()

    # Fetch participant details for the response
    final_participant_details = []
    for user_uuid_to_fetch in [current_user.id, recipient_id]:
        user_id_str = str(user_uuid_to_fetch)
        user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url").eq("id", user_id_str).single().execute()
        final_participant_details.append(ChatParticipant(**user_resp.data))
    
    return ChatResponse(
        id=created_chat_data["id"],
        participants=final_participant_details,
        last_message=None, # New chat has no messages
        created_at=created_chat_data["created_at"],
        updated_at=created_chat_data["updated_at"],
    )

@router.get("/", response_model=ChatListResponse)
async def list_chats(
    current_user: UserPublic = Depends(get_current_active_user),
):
    # Get chat_ids current user is part of
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    user_chat_ids = list(set([row["chat_id"] for row in user_chats_resp.data])) # Use set for unique IDs

    chat_responses = []
    for chat_id_uuid in user_chat_ids:
        chat_id_str = str(chat_id_uuid)
        chat_detail_resp = await db_manager.get_table("chats").select("*").eq("id", chat_id_str).maybe_single().execute()
        if not chat_detail_resp.data:
            continue # Should not happen if chat_participants table is consistent
        
        chat_data = chat_detail_resp.data
        
        # Get participants for this chat
        participants_in_chat_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id_str).execute()
        participant_ids_in_chat = [row["user_id"] for row in participants_in_chat_resp.data]
        
        participant_details_list = []
        for p_id_uuid in participant_ids_in_chat:
            p_id_str = str(p_id_uuid)
            user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url").eq("id", p_id_str).single().execute()
            participant_details_list.append(ChatParticipant(**user_resp.data))
        
        # Get last message for this chat
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
    # Sort chats by last message timestamp (or chat creation if no message)
    chat_responses.sort(key=lambda c: (c.last_message.created_at if c.last_message else c.created_at), reverse=True)
    return ChatListResponse(chats=chat_responses)


@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def get_messages(
    chat_id: UUID,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None, # Pass as ISO string from client
    current_user: UserPublic = Depends(get_current_active_user),
):
    # Validate user is participant
    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    query = db_manager.get_table("messages").select("*").eq("chat_id", str(chat_id))
    if before_timestamp:
        # Ensure before_timestamp is timezone-aware if Supabase stores TIMESTAMPTZ
        query = query.lt("created_at", before_timestamp.isoformat())
    
    messages_resp = await query.order("created_at", desc=True).limit(limit).execute()
    
    messages_response = [MessageInDB(**m) for m in messages_resp.data]
    return MessageListResponse(messages=messages_response)

@router.post("/{chat_id}/messages", response_model=MessageInDB)
async def send_message_http( # Renamed to avoid conflict with WebSocket handler's intent
    chat_id: UUID,
    message_create: MessageCreate, # Note: MessageCreate schema updated
    current_user: UserPublic = Depends(get_current_active_user),
):
    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(current_user.id)).maybe_single().execute()
    if not participant_check_resp.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this chat")

    message_id = uuid4()
    now = datetime.now(timezone.utc)
    
    message_data_to_insert = {
        "id": str(message_id),
        "chat_id": str(chat_id),
        "user_id": str(current_user.id),
        "text": message_create.text,
        "clip_type": message_create.clip_type,
        "clip_placeholder_text": message_create.clip_placeholder_text,
        "clip_url": message_create.clip_url,
        "image_url": message_create.image_url,
        "client_temp_id": message_create.client_temp_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "reactions": {}, # Initialize with empty reactions
    }
    
    insert_resp = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to send message")
        
    new_message_db = insert_resp.data[0]

    # Update chat's updated_at and last_message_id (optional)
    await db_manager.get_table("chats").update({
        "updated_at": now.isoformat(),
        # "last_message_id": str(new_message_db["id"]) # If you store this
    }).eq("id", str(chat_id)).execute()

    message_for_response = MessageInDB(**new_message_db)
    
    # Broadcast via WebSocket
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
        if not reactions[emoji]: # If list becomes empty, remove emoji key
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

# This endpoint was previously in auth/routes.py, moved here for chat context
@router.get("/me/default-chat-partner", response_model=Optional[DefaultChatPartnerResponse])
async def get_default_chat_partner(
    current_user: UserPublic = Depends(get_current_active_user),
):
    # Get the most recently updated chat for the current user
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(current_user.id)).execute()
    user_chat_ids = [str(row["chat_id"]) for row in user_chats_resp.data]

    if not user_chat_ids:
        return None

    # Find chats with their updated_at times
    # This is a bit simplified; a direct query for the latest chat involving the user would be better.
    chats_query = db_manager.get_table("chats").select("id, updated_at").in_("id", user_chat_ids).order("updated_at", desc=True).limit(1)
    latest_chat_resp = await chats_query.maybe_single().execute()

    if not latest_chat_resp.data:
        return None
    
    latest_chat_id = str(latest_chat_resp.data["id"])
    
    # Get participants of this latest chat
    participants_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", latest_chat_id).execute()
    
    other_participant_id = None
    for p_row in participants_resp.data:
        if UUID(p_row["user_id"]) != current_user.id:
            other_participant_id = str(p_row["user_id"])
            break
            
    if not other_participant_id:
        return None # Should not happen in a 2-person chat context

    partner_user_resp = await db_manager.get_table("users").select("id, display_name, avatar_url").eq("id", other_participant_id).single().execute()
    return DefaultChatPartnerResponse(**partner_user_resp.data)


# Ping endpoint needs to be on User router, as it targets a user
# Moved from here to auth_router (user_router specifically)

# Remove redundant user_router = APIRouter(...) definition as it's in auth_router
# from fastapi import APIRouter, Depends
# user_router = APIRouter(prefix="/users", tags=["Users"]) # This was defined in auth/routes.py

# @user_router.post("/{recipient_user_id}/ping")
# async def send_ping(
#     recipient_user_id: UUID,
#     current_user: UserPublic = Depends(get_current_active_user),
# ):
#     # Check if recipient exists
#     recipient_user_resp = await db_manager.get_table("users").select("id, display_name").eq("id", str(recipient_user_id)).maybe_single().execute()
#     if not recipient_user_resp.data:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found")

#     recipient_data = recipient_user_resp.data

#     await manager.send_personal_message_by_user_id(
#         {
#             "event_type": "thinking_of_you_received",
#             "sender_id": str(current_user.id),
#             "sender_name": current_user.display_name, # Use display_name
#         },
#         recipient_user_id,
#     )
#     return {"status": "Ping sent"}

# The get_default_chat_partner previously here was using SQLAlchemy, it's been refactored above.
# from sqlalchemy.orm import Session # Remove SQLAlchemy
# from app.chat.models import Chat, chat_participants # Remove SQLAlchemy models
# def get_db(): pass # Remove get_db placeholder if not using SQLAlchemy
