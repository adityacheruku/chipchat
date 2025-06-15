
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from typing import List, Optional, Dict # Added Dict
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta # Added timedelta
import json

from app.websocket.manager import manager
from app.auth.schemas import UserPublic, TokenData
from app.chat.schemas import MessageCreate, MessageInDB, ReactionToggle, SupportedEmoji
from app.database import db_manager
from app.utils.logging import logger

from app.config import settings
from jose import jwt, JWTError, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError
from starlette.websockets import WebSocketState

router = APIRouter(prefix="/ws", tags=["WebSocket"])

# --- Simple In-Memory Rate Limiter for Messages ---
# WARNING: This is for demonstration and single-instance deployments.
# For production/scaled environments, use a distributed store like Redis.
MAX_MESSAGES_PER_WINDOW = 20
MESSAGE_WINDOW_SECONDS = 60
user_message_timestamps: Dict[UUID, List[datetime]] = {}
# --- End Rate Limiter ---

async def get_user_from_token_for_ws(token: Optional[str] = Query(None)) -> Optional[UserPublic]:
    if not token:
        logger.warning("WS Auth: Token not provided in query parameters.")
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        phone: Optional[str] = payload.get("sub")
        user_id_str: Optional[str] = payload.get("user_id")

        if phone is None and user_id_str is None:
            logger.warning("WS Auth: Token missing both phone (sub) and user_id.")
            return None
        
        token_data = TokenData(phone=phone, user_id=UUID(user_id_str) if user_id_str else None)
        logger.info(f"WS Auth: Token decoded for user_id='{token_data.user_id}', phone='{token_data.phone}'")

    except ExpiredSignatureError:
        logger.warning("WS Auth: Token has expired.")
        return None
    except JWTClaimsError:
        logger.warning("WS Auth: Token claims are invalid.")
        return None
    except JWTError as e:
        logger.warning(f"WS Auth: General JWT Error: {str(e)}")
        return None
    except ValidationError as e: # Pydantic validation for TokenData structure
        logger.warning(f"WS Auth: Pydantic ValidationError for TokenData: {str(e)}")
        return None
    
    user_dict = None
    try:
        if token_data.user_id:
            logger.info(f"WS Auth: Attempting to fetch user by ID: {token_data.user_id}")
            response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
            user_dict = response.data
        elif token_data.phone: 
            logger.info(f"WS Auth: Attempting to fetch user by phone: {token_data.phone}")
            response = await db_manager.get_table("users").select("*").eq("phone", token_data.phone).maybe_single().execute()
            user_dict = response.data
    except Exception as e: # Catch potential DB connection errors during auth
        logger.error(f"WS Auth: Database error while fetching user: {e}", exc_info=True)
        return None # Treat DB error during auth lookup as auth failure for simplicity here
    
    if user_dict is None:
        logger.warning(f"WS Auth: User not found in DB for token_data: user_id='{token_data.user_id}', phone='{token_data.phone}'")
        return None
    
    try:
        # Validate with Pydantic model
        user_for_return = UserPublic(**user_dict)
        logger.info(f"WS Auth: Successfully authenticated user for WebSocket: {user_for_return.id} ({user_for_return.display_name})")
        return user_for_return
    except ValidationError as e:
        logger.error(f"WS Auth: Pydantic ValidationError creating UserPublic from DB for user ID '{user_dict.get('id')}': {str(e)}")
        return None


@router.websocket("/connect") 
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    current_user: Optional[UserPublic] = await get_user_from_token_for_ws(token=token)

    if not current_user:
        logger.warning("WS Auth: Authentication failed or user not found. Accepting and closing WebSocket with 1008.")
        await websocket.accept() 
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = current_user.id
    await manager.connect(websocket, user_id)
    
    now_utc = datetime.now(timezone.utc)
    try:
        await db_manager.get_table("users").update({
            "is_online": True, 
            "last_seen": now_utc.isoformat()
        }).eq("id", str(user_id)).execute()
        
        user_data_for_presence_resp = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
        if not user_data_for_presence_resp.data: # Should not happen if user just authenticated
            logger.error(f"WS Connect: User {user_id} not found when fetching mood post-connection. This is unexpected.")
            # This indicates a server-side data consistency issue.
            raise Exception("User data disappeared post-connection which is unexpected.")

        current_mood = user_data_for_presence_resp.data.get("mood", "Neutral") # Default if mood is somehow null
        await manager.broadcast_presence_update_to_relevant_users(user_id, True, now_utc, current_mood, db_manager)

    except Exception as e: # Catch errors during DB update or initial broadcast
        logger.error(f"Error during WS connect (DB update/broadcast) for user {user_id}: {str(e)}", exc_info=True)
        await manager.disconnect(user_id) # Clean up connection from manager
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Server error during connection setup")
        return # Do not proceed to message loop if setup failed

    try:
        while True:
            raw_data = await websocket.receive_text() 
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                logger.warning(f"WS user {user_id}: Invalid JSON payload received: {raw_data[:100]}") # Log only first 100 chars
                await websocket.send_json({"event_type": "error", "detail": "Invalid JSON payload"})
                continue

            event_type = data.get("event_type")
            logger.info(f"WS user {user_id}: Received event_type '{event_type}' with data (keys): {list(data.keys()) if isinstance(data, dict) else 'Non-dict payload'}")


            try: # Encapsulate each event's logic for better error isolation and specific error feedback
                if event_type == "send_message":
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id")
                    chat_id = UUID(chat_id_str)
                    
                    # --- Rate Limiting Check ---
                    current_time = datetime.now(timezone.utc)
                    if user_id not in user_message_timestamps:
                        user_message_timestamps[user_id] = []
                    
                    # Filter out old timestamps
                    user_message_timestamps[user_id] = [
                        ts for ts in user_message_timestamps[user_id]
                        if current_time - ts < timedelta(seconds=MESSAGE_WINDOW_SECONDS)
                    ]
                    
                    if len(user_message_timestamps[user_id]) >= MAX_MESSAGES_PER_WINDOW:
                        logger.warning(f"WS user {user_id}: Rate limit exceeded for sending messages.")
                        await websocket.send_json({
                            "event_type": "error",
                            "detail": "You are sending messages too quickly. Please wait a moment."
                        })
                        continue # Skip processing this message
                    # --- End Rate Limiting Check ---
                    
                    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check_resp.data:
                        logger.warning(f"WS user {user_id} tried to send message to chat {chat_id} but is not a participant.")
                        await websocket.send_json({"event_type": "error", "detail": "You are not a participant of this chat."})
                        continue
                    
                    text = data.get("text")
                    clip_type = data.get("clip_type")
                    clip_placeholder_text = data.get("clip_placeholder_text")
                    clip_url = data.get("clip_url")
                    image_url = data.get("image_url")
                    client_temp_id = data.get("client_temp_id")
                    message_db_id = uuid4()
                    msg_now = datetime.now(timezone.utc)
                    new_message_payload = {
                        "id": str(message_db_id), "chat_id": str(chat_id), "user_id": str(user_id),
                        "text": text, "clip_type": clip_type, "clip_placeholder_text": clip_placeholder_text,
                        "clip_url": clip_url, "image_url": image_url, "client_temp_id": client_temp_id,
                        "created_at": msg_now.isoformat(), "updated_at": msg_now.isoformat(), "reactions": {},
                    }
                    insert_result = await db_manager.get_table("messages").insert(new_message_payload).execute()
                    
                    if not insert_result.data: # Should not happen if admin_client is used and DB is responsive
                        logger.error(f"WS user {user_id}: Failed to save message to DB. Payload: {new_message_payload}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to save your message to the database."})
                        continue
                    
                    user_message_timestamps[user_id].append(current_time) # Add timestamp after successful save

                    await db_manager.get_table("chats").update({"updated_at": msg_now.isoformat()}).eq("id", str(chat_id)).execute()
                    message_out = MessageInDB(**insert_result.data[0])
                    await manager.broadcast_chat_message(str(chat_id), message_out, db_manager)

                elif event_type == "toggle_reaction":
                    message_id_str = data.get("message_id")
                    chat_id_str = data.get("chat_id") # Important for permission check
                    emoji_str = data.get("emoji")
                    if not all([message_id_str, chat_id_str, emoji_str]):
                        raise ValueError("Missing message_id, chat_id, or emoji for toggle_reaction")
                    
                    message_id = UUID(message_id_str)
                    chat_id = UUID(chat_id_str) # For permission check
                    emoji = SupportedEmoji(emoji_str) # Pydantic will validate if emoji is valid based on schema

                    # Permission check: Is user part of the chat where the message exists?
                    participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check_resp.data:
                        logger.warning(f"WS user {user_id} tried to react in chat {chat_id} but is not a participant.")
                        await websocket.send_json({"event_type": "error", "detail": "You cannot react in a chat you are not part of."})
                        continue
                    
                    msg_resp = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
                    if not msg_resp.data:
                        logger.warning(f"WS user {user_id}: Message {message_id} not found for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message not found."})
                        continue
                    
                    message_db = msg_resp.data
                    # Ensure the message indeed belongs to the chat_id specified by client (for consistency)
                    if str(message_db["chat_id"]) != str(chat_id):
                        logger.warning(f"WS user {user_id}: Message {message_id} (chat {message_db['chat_id']}) does not belong to specified chat {chat_id} for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message does not belong to the specified chat."})
                        continue

                    reactions = message_db.get("reactions", {}) or {} # Ensure reactions is a dict
                    user_id_str_for_reaction = str(user_id)

                    if emoji not in reactions: reactions[emoji] = []
                    
                    if user_id_str_for_reaction in reactions[emoji]:
                        reactions[emoji].remove(user_id_str_for_reaction)
                        if not reactions[emoji]: del reactions[emoji] # Remove emoji key if no users reacted with it
                    else:
                        reactions[emoji].append(user_id_str_for_reaction)
                    
                    update_reaction_result = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
                    if not update_reaction_result.data: # Should not happen if DB is responsive
                        logger.error(f"WS user {user_id}: Failed to update reaction for message {message_id}. Reactions: {reactions}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to save your reaction."})
                        continue
                    
                    updated_message_out = MessageInDB(**update_reaction_result.data[0])
                    await manager.broadcast_reaction_update(str(chat_id), updated_message_out, db_manager)

                elif event_type in ["start_typing", "stop_typing"]:
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id for typing indicator")
                    chat_id = UUID(chat_id_str) # Validate UUID format
                    # Permission check: Is user part of this chat? (Implicitly handled by broadcast logic if it filters recipients)
                    # For explicit check:
                    # participant_check_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    # if not participant_check_resp.data:
                    #     await websocket.send_json({"event_type": "error", "detail": "Cannot send typing indicator for a chat you are not in."})
                    #     continue
                    is_typing = event_type == "start_typing"
                    await manager.broadcast_typing_indicator(str(chat_id), user_id, is_typing, db_manager)
                
                elif event_type == "ping_thinking_of_you":
                    recipient_user_id_str = data.get("recipient_user_id")
                    if not recipient_user_id_str: raise ValueError("Missing recipient_user_id for ping")
                    recipient_user_id = UUID(recipient_user_id_str) # Validate UUID
                    
                    recipient_check_resp = await db_manager.get_table("users").select("id, display_name").eq("id", str(recipient_user_id)).maybe_single().execute()
                    if not recipient_check_resp.data:
                        logger.warning(f"WS user {user_id}: Recipient user {recipient_user_id} not found for ping.")
                        await websocket.send_json({"event_type": "error", "detail": "Recipient user not found."})
                        continue
                    # Here, we might also check if there's a mutual chat between current_user and recipient_user_id
                    # for more stringent permissioning, but for a simple ping, just existence might be okay.

                    await manager.send_personal_message_by_user_id(
                        {
                            "event_type": "thinking_of_you_received",
                            "sender_id": str(user_id),
                            "sender_name": current_user.display_name, 
                        },
                        recipient_user_id,
                    )
                else:
                    logger.warning(f"WS user {user_id}: Unknown event_type received: {event_type}")
                    await websocket.send_json({"event_type": "error", "detail": f"Unknown event_type: {event_type}"})
            
            except (TypeError, ValueError, KeyError, ValidationError) as e_payload: # Catch payload/validation errors for current event
                logger.warning(f"WS user {user_id}: Invalid payload or validation error for {event_type}: {str(e_payload)}. Data: {data}", exc_info=False) # exc_info False to avoid spamming logs with common payload errors
                await websocket.send_json({"event_type": "error", "detail": f"Invalid payload for {event_type}: {str(e_payload)}"})
            except Exception as e_general: # Catch other unexpected errors (DB, manager calls etc.) for current event
                logger.error(f"WS user {user_id}: Error processing event {event_type}: {str(e_general)}", exc_info=True)
                await websocket.send_json({"event_type": "error", "detail": f"A server error occurred while processing your request for {event_type}."})


    except WebSocketDisconnect:
        logger.info(f"WS user {user_id} disconnected (WebSocketDisconnect received).")
    except Exception as e: # Catch unexpected errors in the main WebSocket loop itself
        logger.error(f"Unexpected error in WebSocket loop for user {user_id}: {str(e)}", exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
             try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Unexpected server error in message loop")
             except RuntimeError: # Handle race condition if socket is already closing/closed
                logger.warning(f"WS user {user_id}: Tried to close WebSocket during main loop error, but it was already closing/closed.")
                pass # Socket likely already closed or closing
    finally: 
        logger.info(f"WS user {user_id} entering finally block. Cleaning up connection.")
        await manager.disconnect(user_id) 
        # Clear rate limit timestamps for the user on disconnect
        if user_id in user_message_timestamps:
            del user_message_timestamps[user_id]
            logger.info(f"WS user {user_id}: Cleared rate limit timestamps on disconnect.")

        offline_now = datetime.now(timezone.utc)
        try:
            await db_manager.get_table("users").update({
                "is_online": False, 
                "last_seen": offline_now.isoformat()
            }).eq("id", str(user_id)).execute()

            # Fetch mood again for offline presence, default if user disappears (shouldn't happen)
            user_data_for_offline_presence_resp = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
            offline_mood = "Neutral" # Default mood
            if user_data_for_offline_presence_resp and user_data_for_offline_presence_resp.data:
                 offline_mood = user_data_for_offline_presence_resp.data.get("mood", "Neutral")
            
            await manager.broadcast_presence_update_to_relevant_users(user_id, False, offline_now, offline_mood, db_manager)
        except Exception as e_cleanup:
            logger.error(f"Error during WS disconnect cleanup (DB update/broadcast) for user {user_id}: {str(e_cleanup)}", exc_info=True)

    