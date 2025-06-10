
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
import json

from app.websocket.manager import manager
from app.auth.dependencies import get_current_user # Using the HTTP Auth dep for token validation
from app.auth.schemas import UserPublic, TokenData # For typing and token data
from app.chat.schemas import MessageCreate, MessageInDB, ReactionToggle, SupportedEmoji
from app.database import db_manager # Using db_manager directly

router = APIRouter(prefix="/ws", tags=["WebSocket"])

async def get_user_from_token_for_ws(token: str = Query(...)) -> UserPublic:
    """
    Authenticates a user for WebSocket connection using a token passed as a query parameter.
    This is a simplified version of get_current_user, adapted for WS.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, # Though WS will just close
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        user_id_str: Optional[str] = payload.get("user_id")

        if email is None and user_id_str is None:
            raise credentials_exception
        
        user_id = UUID(user_id_str) if user_id_str else None

    except JWTError:
        raise credentials_exception # Will result in WebSocket closing
    
    if user_id:
        user_resp = await db_manager.get_table("users").select("*").eq("id", str(user_id)).maybe_single().execute()
    elif email: # Fallback if only email in token (less ideal)
         user_resp = await db_manager.get_table("users").select("*").eq("email", email).maybe_single().execute()
    else:
        raise credentials_exception

    if not user_resp.data:
        raise credentials_exception
        
    return UserPublic(**user_resp.data)


@router.websocket("/connect") # Changed path for clarity, or use /ws and authenticate after connect
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        current_user = await get_user_from_token_for_ws(token=token)
    except Exception: # Includes HTTPException from get_user_from_token_for_ws
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION) # Close for auth failure
        return

    user_id = current_user.id
    await manager.connect(websocket, user_id)
    
    # Update user's presence in DB and broadcast
    now = datetime.now(timezone.utc)
    await db_manager.get_table("users").update({
        "is_online": True, 
        "last_seen": now.isoformat()
    }).eq("id", str(user_id)).execute()
    
    # Fetch updated mood for broadcast
    user_data_for_presence = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).single().execute()
    current_mood = user_data_for_presence.data.get("mood", "Neutral")

    await manager.broadcast_presence_update_to_relevant_users(user_id, True, now, current_mood, db_manager)

    try:
        while True:
            raw_data = await websocket.receive_text() # Use receive_text then json.loads for better error handling
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON payload"})
                continue

            event_type = data.get("event_type")

            if event_type == "send_message":
                try:
                    chat_id = UUID(data.get("chat_id"))
                    text = data.get("text")
                    clip_type = data.get("clip_type")
                    clip_placeholder_text = data.get("clip_placeholder_text")
                    clip_url = data.get("clip_url")
                    image_url = data.get("image_url")
                    client_temp_id = data.get("client_temp_id") # For client-side reconciliation
                except (TypeError, ValueError) as e:
                    await websocket.send_json({"error": f"Invalid payload for send_message: {e}"})
                    continue

                # Validate user is participant (important security check)
                participant_check = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                if not participant_check.data:
                    await websocket.send_json({"error": "Not a participant of this chat"})
                    continue
                
                message_db_id = uuid4()
                msg_now = datetime.now(timezone.utc)
                new_message_payload = {
                    "id": str(message_db_id),
                    "chat_id": str(chat_id),
                    "user_id": str(user_id),
                    "text": text,
                    "clip_type": clip_type,
                    "clip_placeholder_text": clip_placeholder_text,
                    "clip_url": clip_url,
                    "image_url": image_url,
                    "client_temp_id": client_temp_id,
                    "created_at": msg_now.isoformat(),
                    "updated_at": msg_now.isoformat(),
                    "reactions": {},
                }
                insert_result = await db_manager.get_table("messages").insert(new_message_payload).execute()
                
                if not insert_result.data:
                    await websocket.send_json({"error": "Failed to save message"})
                    continue
                
                # Update chat's updated_at
                await db_manager.get_table("chats").update({"updated_at": msg_now.isoformat()}).eq("id", str(chat_id)).execute()
                
                message_out = MessageInDB(**insert_result.data[0])
                await manager.broadcast_chat_message(str(chat_id), message_out, db_manager)

            elif event_type == "toggle_reaction":
                try:
                    message_id = UUID(data.get("message_id"))
                    chat_id = UUID(data.get("chat_id")) # Client should send chat_id for context
                    emoji_str = data.get("emoji")
                    if emoji_str not in SupportedEmoji.__args__ if hasattr(SupportedEmoji, '__args__') else True: # Basic validation
                         emoji = SupportedEmoji(emoji_str) # Cast to type
                except (TypeError, ValueError) as e:
                    await websocket.send_json({"error": f"Invalid payload for toggle_reaction: {e}"})
                    continue

                msg_resp = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
                if not msg_resp.data:
                    await websocket.send_json({"error": "Message not found"})
                    continue
                
                message_db = msg_resp.data
                if str(message_db["chat_id"]) != str(chat_id): # Ensure consistency
                     await websocket.send_json({"error": "Message does not belong to the specified chat"})
                     continue

                participant_check = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                if not participant_check.data:
                    await websocket.send_json({"error": "Not a participant of this chat"})
                    continue

                reactions = message_db.get("reactions", {}) or {} # Ensure it's a dict
                user_id_str_for_reaction = str(user_id)

                if emoji not in reactions: reactions[emoji] = []
                
                if user_id_str_for_reaction in reactions[emoji]:
                    reactions[emoji].remove(user_id_str_for_reaction)
                    if not reactions[emoji]: del reactions[emoji]
                else:
                    reactions[emoji].append(user_id_str_for_reaction)
                
                update_reaction_result = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
                if not update_reaction_result.data:
                    await websocket.send_json({"error": "Failed to update reaction"})
                    continue
                
                updated_message_out = MessageInDB(**update_reaction_result.data[0])
                await manager.broadcast_reaction_update(str(chat_id), updated_message_out, db_manager)

            elif event_type in ["start_typing", "stop_typing"]:
                try:
                    chat_id = UUID(data.get("chat_id"))
                except (TypeError, ValueError):
                    await websocket.send_json({"error": "Invalid chat_id for typing indicator"})
                    continue
                
                is_typing = event_type == "start_typing"
                await manager.broadcast_typing_indicator(str(chat_id), user_id, is_typing, db_manager)

            elif event_type == "ping_thinking_of_you": # Handled by HTTP endpoint for simplicity from PWA shortcuts
                # If WS initiated ping is desired:
                try:
                    recipient_user_id = UUID(data.get("recipient_user_id"))
                except (TypeError, ValueError):
                     await websocket.send_json({"error": "Invalid recipient_user_id for ping"})
                     continue
                
                # Check if recipient exists
                recipient_check = await db_manager.get_table("users").select("id, display_name").eq("id", str(recipient_user_id)).maybe_single().execute()
                if not recipient_check.data:
                    await websocket.send_json({"error": "Recipient user not found"})
                    continue

                await manager.send_personal_message_by_user_id(
                    {
                        "event_type": "thinking_of_you_received",
                        "sender_id": str(user_id),
                        "sender_name": current_user.display_name,
                    },
                    recipient_user_id,
                )
            else:
                await websocket.send_json({"error": f"Unknown event_type: {event_type}"})

    except WebSocketDisconnect:
        print(f"WS
User {user_id} disconnected explicitly or due to error.")
    except Exception as e: # Catch other errors during WS communication
        print(f"Error in WebSocket for user {user_id}: {e}")
        # await websocket.close(code=status.WS_1011_INTERNAL_ERROR) # Optionally send error code
    finally: # Ensure disconnect logic runs
        await manager.disconnect(user_id)
        # Update user's presence in DB and broadcast
        offline_now = datetime.now(timezone.utc)
        await db_manager.get_table("users").update({
            "is_online": False, 
            "last_seen": offline_now.isoformat()
        }).eq("id", str(user_id)).execute()

        # Fetch updated mood for broadcast
        user_data_for_offline_presence = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).single().execute()
        offline_mood = user_data_for_offline_presence.data.get("mood", "Neutral")

        await manager.broadcast_presence_update_to_relevant_users(user_id, False, offline_now, offline_mood, db_manager)

# JWT and settings imports for get_user_from_token_for_ws
from app.config import settings
from jose import jwt, JWTError
