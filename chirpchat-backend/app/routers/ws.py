from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta 
import json
import asyncio # Added for throttled last_seen

from app.websocket.manager import manager
from app.auth.schemas import UserPublic, TokenData
from app.chat.schemas import MessageCreate, MessageInDB, ReactionToggle, SupportedEmoji, MessageStatusEnum, SUPPORTED_EMOJIS
from app.database import db_manager
from app.utils.logging import logger

from app.config import settings
from jose import jwt, JWTError, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError
from starlette.websockets import WebSocketState

router = APIRouter(prefix="/ws", tags=["WebSocket"])

# Server-Side Rate Limiting
MAX_MESSAGES_PER_WINDOW = 20
MESSAGE_WINDOW_SECONDS = 60
user_message_timestamps: Dict[UUID, List[datetime]] = {}

MAX_REACTIONS_PER_WINDOW = 15
REACTION_WINDOW_SECONDS = 10
user_reaction_timestamps: Dict[UUID, List[datetime]] = {}


# For throttled last_seen updates on heartbeat/activity
user_last_activity_update_db: Dict[UUID, datetime] = {}
THROTTLE_LAST_SEEN_UPDATE_SECONDS = 120 # 2 minutes

async def update_user_last_seen_throttled(user_id: UUID, db_manager_instance: Any):
    now = datetime.now(timezone.utc)
    # Check if user_id is in user_last_activity_update_db before accessing
    last_update_time = user_last_activity_update_db.get(user_id)
    
    if last_update_time is None or (now - last_update_time).total_seconds() > THROTTLE_LAST_SEEN_UPDATE_SECONDS:
        try:
            await db_manager_instance.get_table("users").update({"last_seen": now.isoformat()}).eq("id", str(user_id)).execute()
            user_last_activity_update_db[user_id] = now
            logger.info(f"WS: Throttled last_seen update for user {user_id} to {now.isoformat()}")
        except Exception as e:
            logger.error(f"WS: Error updating last_seen for user {user_id} in DB: {e}", exc_info=True)


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
        logger.warning(f"WS Auth: Token claims are invalid (JWTClaimsError).")
        return None
    except JWTError as e: 
        logger.warning(f"WS Auth: General JWT Error: {str(e)} ({type(e).__name__}).")
        return None
    except ValidationError as e: 
        logger.warning(f"WS Auth: Pydantic ValidationError for TokenData: {str(e)}")
        return None
    except Exception as e: 
        logger.error(f"WS Auth: Unexpected error during token decoding/validation: {e}", exc_info=True)
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
    except Exception as e: 
        logger.error(f"WS Auth: Database error while fetching user for token validation: {e}", exc_info=True)
        return None 
    
    if user_dict is None:
        logger.warning(f"WS Auth: User not found in DB for token_data: user_id='{token_data.user_id}', phone='{token_data.phone}'")
        return None
    
    try:
        user_for_return = UserPublic(**user_dict)
        logger.info(f"WS Auth: Successfully authenticated user for WebSocket: {user_for_return.id} ({user_for_return.display_name})")
        return user_for_return
    except ValidationError as e:
        logger.error(f"WS Auth: Pydantic ValidationError creating UserPublic from DB for user ID '{user_dict.get('id')}': {str(e)}")
        return None
    except Exception as e: 
        logger.error(f"WS Auth: Unexpected error creating UserPublic from DB data for user ID '{user_dict.get('id')}': {e}", exc_info=True)
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
    
    try:
        await manager.connect(websocket, user_id, db_manager) # Pass db_manager
        # DB update for online and presence broadcast is now handled within manager.connect
    except Exception as e: 
        logger.error(f"Error during WS connect for user {user_id}: {str(e)}", exc_info=True)
        # manager.disconnect is not directly called here; cleanup handled in finally
        if websocket.client_state != WebSocketState.DISCONNECTED: 
            try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Server error during connection setup")
            except RuntimeError as re: 
                 logger.warning(f"WS user {user_id}: Runtime error closing WebSocket during setup error: {re}")
        return 

    try:
        while True:
            raw_data = await websocket.receive_text() 
            # Any message from client implies activity, update last_seen (throttled)
            await update_user_last_seen_throttled(user_id, db_manager)

            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                logger.warning(f"WS user {user_id}: Invalid JSON payload received: {raw_data[:100]}") 
                await websocket.send_json({"event_type": "error", "detail": "Invalid JSON payload"})
                continue

            event_type = data.get("event_type")
            logger.info(f"WS user {user_id}: Received event_type '{event_type}' with data (keys): {list(data.keys()) if isinstance(data, dict) else 'Non-dict payload'}")


            try: 
                if event_type == "send_message":
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id")
                    chat_id = UUID(chat_id_str)
                    
                    current_time_for_rate_limit = datetime.now(timezone.utc) 
                    if user_id not in user_message_timestamps:
                        user_message_timestamps[user_id] = []
                    
                    user_message_timestamps[user_id] = [
                        ts for ts in user_message_timestamps[user_id]
                        if current_time_for_rate_limit - ts < timedelta(seconds=MESSAGE_WINDOW_SECONDS)
                    ]
                    
                    if len(user_message_timestamps[user_id]) >= MAX_MESSAGES_PER_WINDOW:
                        logger.warning(f"WS user {user_id}: Rate limit exceeded for sending messages.")
                        await websocket.send_json({
                            "event_type": "error",
                            "detail": "You are sending messages too quickly. Please wait a moment."
                        })
                        continue 
                    
                    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check_resp_obj or not participant_check_resp_obj.data:
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
                        "clip_url": clip_url, "image_url": image_url, 
                        "client_temp_id": client_temp_id, 
                        "status": MessageStatusEnum.SENT_TO_SERVER.value, 
                        "created_at": msg_now.isoformat(), "updated_at": msg_now.isoformat(), "reactions": {},
                    }
                    insert_result_obj = await db_manager.get_table("messages").insert(new_message_payload).execute()
                    
                    if not insert_result_obj or not insert_result_obj.data: 
                        logger.error(f"WS user {user_id}: Failed to save message to DB. Payload: {new_message_payload}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to save your message to the database."})
                        continue
                    
                    user_message_timestamps[user_id].append(current_time_for_rate_limit) 

                    await db_manager.get_table("chats").update({"updated_at": msg_now.isoformat()}).eq("id", str(chat_id)).execute()
                    message_out = MessageInDB(**insert_result_obj.data[0])
                    await manager.broadcast_chat_message(str(chat_id), message_out, db_manager)

                elif event_type == "toggle_reaction":
                    message_id_str = data.get("message_id")
                    chat_id_str = data.get("chat_id") 
                    emoji_str = data.get("emoji")
                    if not all([message_id_str, chat_id_str, emoji_str]):
                        raise ValueError("Missing message_id, chat_id, or emoji for toggle_reaction")
                    
                    # --- SERVER-SIDE INPUT VALIDATION ---
                    if emoji_str not in SUPPORTED_EMOJIS:
                        logger.warning(f"WS user {user_id}: Invalid emoji '{emoji_str}' received for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Invalid emoji provided."})
                        continue

                    # --- SERVER-SIDE RATE LIMITING ---
                    current_time_for_rate_limit = datetime.now(timezone.utc)
                    if user_id not in user_reaction_timestamps:
                        user_reaction_timestamps[user_id] = []
                    
                    user_reaction_timestamps[user_id] = [
                        ts for ts in user_reaction_timestamps[user_id]
                        if current_time_for_rate_limit - ts < timedelta(seconds=REACTION_WINDOW_SECONDS)
                    ]

                    if len(user_reaction_timestamps[user_id]) >= MAX_REACTIONS_PER_WINDOW:
                        logger.warning(f"WS user {user_id}: Rate limit exceeded for toggling reactions.")
                        await websocket.send_json({
                            "event_type": "error",
                            "detail": "You are reacting too quickly. Please wait a moment."
                        })
                        continue
                    
                    message_id = UUID(message_id_str)
                    chat_id = UUID(chat_id_str) 
                    emoji = SupportedEmoji(emoji_str) 

                    participant_check_resp_obj = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check_resp_obj or not participant_check_resp_obj.data:
                        logger.warning(f"WS user {user_id} tried to react in chat {chat_id} but is not a participant.")
                        await websocket.send_json({"event_type": "error", "detail": "You cannot react in a chat you are not part of."})
                        continue
                    
                    msg_resp_obj = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
                    if not msg_resp_obj or not msg_resp_obj.data:
                        logger.warning(f"WS user {user_id}: Message {message_id} not found for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message not found."})
                        continue
                    
                    message_db = msg_resp_obj.data
                    if str(message_db["chat_id"]) != str(chat_id):
                        logger.warning(f"WS user {user_id}: Message {message_id} (chat {message_db['chat_id']}) does not belong to specified chat {chat_id} for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message does not belong to the specified chat."})
                        continue

                    reactions = message_db.get("reactions", {}) or {} 
                    user_id_str_for_reaction = str(user_id)
                    action_taken = "added"

                    if emoji not in reactions: reactions[emoji] = []
                    
                    if user_id_str_for_reaction in reactions[emoji]:
                        reactions[emoji].remove(user_id_str_for_reaction)
                        if not reactions[emoji]: del reactions[emoji] 
                        action_taken = "removed"
                    else:
                        reactions[emoji].append(user_id_str_for_reaction)
                        action_taken = "added"
                    
                    update_reaction_result_obj = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
                    if not update_reaction_result_obj or not update_reaction_result_obj.data: 
                        logger.error(f"WS user {user_id}: Failed to update reaction for message {message_id}. Reactions: {reactions}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to save your reaction."})
                        continue
                    
                    # Audit Log
                    logger.info(f"AUDIT: ReactionToggle - User '{user_id}' {action_taken} reaction '{emoji}' on message '{message_id}' in chat '{chat_id}'.")

                    user_reaction_timestamps[user_id].append(current_time_for_rate_limit)

                    updated_message_out = MessageInDB(**update_reaction_result_obj.data[0])
                    await manager.broadcast_reaction_update(str(chat_id), updated_message_out, db_manager)

                elif event_type in ["start_typing", "stop_typing"]:
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id for typing indicator")
                    chat_id = UUID(chat_id_str)
                    is_typing = event_type == "start_typing"
                    await manager.broadcast_typing_indicator(str(chat_id), user_id, is_typing, db_manager)
                
                elif event_type == "ping_thinking_of_you":
                    recipient_user_id_str = data.get("recipient_user_id")
                    if not recipient_user_id_str: raise ValueError("Missing recipient_user_id for ping")
                    recipient_user_id = UUID(recipient_user_id_str) 
                    
                    recipient_check_resp_obj = await db_manager.get_table("users").select("id, display_name").eq("id", str(recipient_user_id)).maybe_single().execute()
                    if not recipient_check_resp_obj or not recipient_check_resp_obj.data:
                        logger.warning(f"WS user {user_id}: Recipient user {recipient_user_id} not found for ping.")
                        await websocket.send_json({"event_type": "error", "detail": "Recipient user not found."})
                        continue

                    await manager.send_personal_message_by_user_id(
                        {
                            "event_type": "thinking_of_you_received",
                            "sender_id": str(user_id),
                            "sender_name": current_user.display_name, 
                        },
                        recipient_user_id,
                    )
                elif event_type == "HEARTBEAT":
                    logger.debug(f"WS user {user_id}: Received HEARTBEAT.")
                    # `update_user_last_seen_throttled` already called at the start of the loop for any message.
                    # If specific response to heartbeat is needed, add here.
                    # For now, just acknowledging its reception is enough.
                    pass 
                else:
                    logger.warning(f"WS user {user_id}: Unknown event_type received: {event_type}")
                    await websocket.send_json({"event_type": "error", "detail": f"Unknown event_type: {event_type}"})
            
            except (TypeError, ValueError, KeyError, ValidationError) as e_payload: 
                logger.warning(f"WS user {user_id}: Invalid payload or validation error for {event_type}: {str(e_payload)}. Data: {data}", exc_info=False) 
                await websocket.send_json({"event_type": "error", "detail": f"Invalid payload for {event_type}: {str(e_payload)}"})
            except Exception as e_general: 
                logger.error(f"WS user {user_id}: Error processing event {event_type}: {str(e_general)}", exc_info=True)
                await websocket.send_json({"event_type": "error", "detail": f"A server error occurred while processing your request for {event_type}."})


    except WebSocketDisconnect:
        logger.info(f"WS user {user_id} disconnected (WebSocketDisconnect received from client or manager). Code: {websocket.client_state}")
    except Exception as e: 
        logger.error(f"Unexpected error in WebSocket loop for user {user_id}: {str(e)}", exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
             try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Unexpected server error in message loop")
             except RuntimeError as re_main_loop_close: 
                logger.warning(f"WS user {user_id}: Runtime error closing WebSocket during main loop error: {re_main_loop_close}")
    finally: 
        logger.info(f"WS user {user_id}: Connection cleanup started in finally block. State: {websocket.client_state}")
        
        # Schedule graceful disconnect instead of immediate offline update
        await manager.schedule_graceful_disconnect(user_id, db_manager)
        
        if user_id in user_message_timestamps:
            del user_message_timestamps[user_id]
            logger.info(f"WS user {user_id}: Cleared message rate limit timestamps on disconnect.")
        if user_id in user_reaction_timestamps:
            del user_reaction_timestamps[user_id]
            logger.info(f"WS user {user_id}: Cleared reaction rate limit timestamps on disconnect.")

        
        # user_last_activity_update_db is a global cache, might not need clearing per disconnect
        # unless it grows too large or contains stale data for very long offline users.
        # For now, it's kept.

        logger.info(f"WS user {user_id}: Graceful disconnect initiated.")
