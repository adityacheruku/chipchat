
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
import json

from app.websocket.manager import manager
from app.auth.schemas import UserPublic, TokenData
from app.chat.schemas import MessageCreate, MessageInDB, ReactionToggle, SupportedEmoji
from app.database import db_manager
from app.utils.logging import logger

from app.config import settings
from jose import jwt, JWTError, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError


router = APIRouter(prefix="/ws", tags=["WebSocket"])

async def get_user_from_token_for_ws(token: Optional[str] = Query(None)) -> Optional[UserPublic]:
    """
    Authenticates a user for WebSocket connection using a token passed as a query parameter.
    Returns UserPublic if authentication is successful, None otherwise.
    """
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
    except ValidationError as e:
        logger.warning(f"WS Auth: Pydantic ValidationError for TokenData: {str(e)}")
        return None
    
    user_dict = None
    if token_data.user_id:
        logger.info(f"WS Auth: Attempting to fetch user by ID: {token_data.user_id}")
        response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
        user_dict = response.data
    elif token_data.phone:
        logger.info(f"WS Auth: Attempting to fetch user by phone: {token_data.phone}")
        response = await db_manager.get_table("users").select("*").eq("phone", token_data.phone).maybe_single().execute()
        user_dict = response.data
    
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


@router.websocket("/connect") 
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    current_user: Optional[UserPublic] = await get_user_from_token_for_ws(token=token)

    if not current_user:
        logger.warning("WS Auth: Authentication failed or user not found. Closing WebSocket with 1008.")
        await websocket.accept() # Accept briefly to send a proper close code
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = current_user.id
    await manager.connect(websocket, user_id) # manager.connect calls websocket.accept() internally if not already accepted.
                                            # For clarity, if we accepted above, manager.connect should ideally not accept again,
                                            # but most WebSocket libraries handle redundant accepts gracefully.
                                            # If manager.connect was changed not to accept, then the accept above is critical.
                                            # Current manager.connect does `await websocket.accept()`.
                                            # To avoid double accept, we can let manager.connect do it, or do it here and modify manager.
                                            # For now, accepting here and letting manager.connect try again is usually safe.
                                            # A cleaner way would be to pass `accepted=True` to manager.connect if we accept early.
                                            # Let's assume manager.connect is robust. If issues arise, we can modify manager.connect
                                            # to not call accept() if a flag is passed.

    now = datetime.now(timezone.utc)
    try:
        await db_manager.get_table("users").update({
            "is_online": True, 
            "last_seen": now.isoformat()
        }).eq("id", str(user_id)).execute()
        
        user_data_for_presence_resp = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
        if not user_data_for_presence_resp.data:
            logger.error(f"WS Connect: User {user_id} not found when fetching mood post-connection. This should not happen.")
            raise Exception("User data dissapeared post-connection") # This will be caught below

        current_mood = user_data_for_presence_resp.data.get("mood", "Neutral")
        await manager.broadcast_presence_update_to_relevant_users(user_id, True, now, current_mood, db_manager)

    except Exception as e:
        logger.error(f"Error during WS connect (DB update/broadcast) for user {user_id}: {str(e)}", exc_info=True)
        await manager.disconnect(user_id) # Ensure user is removed from active connections
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Server error during connection setup")
        return # Important to return here to not proceed to the message loop

    try:
        while True:
            raw_data = await websocket.receive_text() 
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                logger.warning(f"WS user {user_id}: Invalid JSON payload received: {raw_data[:100]}")
                await websocket.send_json({"event_type": "error", "detail": "Invalid JSON payload"})
                continue

            event_type = data.get("event_type")
            logger.info(f"WS user {user_id}: Received event_type '{event_type}' with data: {data}")


            if event_type == "send_message":
                try:
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id")
                    chat_id = UUID(chat_id_str)
                    
                    text = data.get("text")
                    clip_type = data.get("clip_type")
                    clip_placeholder_text = data.get("clip_placeholder_text")
                    clip_url = data.get("clip_url")
                    image_url = data.get("image_url")
                    client_temp_id = data.get("client_temp_id")

                    participant_check = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check.data:
                        logger.warning(f"WS user {user_id} tried to send message to chat {chat_id} but is not a participant.")
                        await websocket.send_json({"event_type": "error", "detail": "Not a participant of this chat"})
                        continue
                    
                    message_db_id = uuid4()
                    msg_now = datetime.now(timezone.utc)
                    new_message_payload = {
                        "id": str(message_db_id), "chat_id": str(chat_id), "user_id": str(user_id),
                        "text": text, "clip_type": clip_type, "clip_placeholder_text": clip_placeholder_text,
                        "clip_url": clip_url, "image_url": image_url, "client_temp_id": client_temp_id,
                        "created_at": msg_now.isoformat(), "updated_at": msg_now.isoformat(), "reactions": {},
                    }
                    insert_result = await db_manager.get_table("messages").insert(new_message_payload).execute()
                    
                    if not insert_result.data:
                        logger.error(f"WS user {user_id}: Failed to save message to DB. Payload: {new_message_payload}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to save message"})
                        continue
                    
                    await db_manager.get_table("chats").update({"updated_at": msg_now.isoformat()}).eq("id", str(chat_id)).execute()
                    message_out = MessageInDB(**insert_result.data[0])
                    await manager.broadcast_chat_message(str(chat_id), message_out, db_manager)

                except (TypeError, ValueError, KeyError) as e:
                    logger.warning(f"WS user {user_id}: Invalid payload for send_message: {str(e)}. Data: {data}")
                    await websocket.send_json({"event_type": "error", "detail": f"Invalid payload for send_message: {str(e)}"})
                    continue


            elif event_type == "toggle_reaction":
                try:
                    message_id_str = data.get("message_id")
                    chat_id_str = data.get("chat_id")
                    emoji_str = data.get("emoji")
                    if not all([message_id_str, chat_id_str, emoji_str]):
                        raise ValueError("Missing message_id, chat_id, or emoji for toggle_reaction")
                    
                    message_id = UUID(message_id_str)
                    chat_id = UUID(chat_id_str) 
                    emoji = SupportedEmoji(emoji_str) 

                    msg_resp = await db_manager.get_table("messages").select("*").eq("id", str(message_id)).maybe_single().execute()
                    if not msg_resp.data:
                        logger.warning(f"WS user {user_id}: Message {message_id} not found for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message not found"})
                        continue
                    
                    message_db = msg_resp.data
                    if str(message_db["chat_id"]) != str(chat_id):
                        logger.warning(f"WS user {user_id}: Message {message_id} (chat {message_db['chat_id']}) does not belong to specified chat {chat_id} for reaction.")
                        await websocket.send_json({"event_type": "error", "detail": "Message does not belong to the specified chat"})
                        continue

                    participant_check = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
                    if not participant_check.data:
                        logger.warning(f"WS user {user_id} tried to react in chat {chat_id} but is not a participant.")
                        await websocket.send_json({"event_type": "error", "detail": "Not a participant of this chat"})
                        continue

                    reactions = message_db.get("reactions", {}) or {} 
                    user_id_str_for_reaction = str(user_id)

                    if emoji not in reactions: reactions[emoji] = []
                    
                    if user_id_str_for_reaction in reactions[emoji]:
                        reactions[emoji].remove(user_id_str_for_reaction)
                        if not reactions[emoji]: del reactions[emoji]
                    else:
                        reactions[emoji].append(user_id_str_for_reaction)
                    
                    update_reaction_result = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
                    if not update_reaction_result.data:
                        logger.error(f"WS user {user_id}: Failed to update reaction for message {message_id}. Reactions: {reactions}")
                        await websocket.send_json({"event_type": "error", "detail": "Failed to update reaction"})
                        continue
                    
                    updated_message_out = MessageInDB(**update_reaction_result.data[0])
                    await manager.broadcast_reaction_update(str(chat_id), updated_message_out, db_manager)

                except (TypeError, ValueError, KeyError) as e:
                    logger.warning(f"WS user {user_id}: Invalid payload for toggle_reaction: {str(e)}. Data: {data}")
                    await websocket.send_json({"event_type": "error", "detail": f"Invalid payload for toggle_reaction: {str(e)}"})
                    continue


            elif event_type in ["start_typing", "stop_typing"]:
                try:
                    chat_id_str = data.get("chat_id")
                    if not chat_id_str: raise ValueError("Missing chat_id for typing indicator")
                    chat_id = UUID(chat_id_str)
                    is_typing = event_type == "start_typing"
                    await manager.broadcast_typing_indicator(str(chat_id), user_id, is_typing, db_manager)
                except (TypeError, ValueError, KeyError) as e:
                    logger.warning(f"WS user {user_id}: Invalid payload for typing indicator: {str(e)}. Data: {data}")
                    await websocket.send_json({"event_type": "error", "detail": f"Invalid chat_id for typing indicator: {str(e)}"})
                    continue
                

            elif event_type == "ping_thinking_of_you":
                try:
                    recipient_user_id_str = data.get("recipient_user_id")
                    if not recipient_user_id_str: raise ValueError("Missing recipient_user_id for ping")
                    recipient_user_id = UUID(recipient_user_id_str)
                    
                    recipient_check = await db_manager.get_table("users").select("id, display_name").eq("id", str(recipient_user_id)).maybe_single().execute()
                    if not recipient_check.data:
                        logger.warning(f"WS user {user_id}: Recipient user {recipient_user_id} not found for ping.")
                        await websocket.send_json({"event_type": "error", "detail": "Recipient user not found"})
                        continue

                    await manager.send_personal_message_by_user_id(
                        {
                            "event_type": "thinking_of_you_received",
                            "sender_id": str(user_id),
                            "sender_name": current_user.display_name, 
                        },
                        recipient_user_id,
                    )
                except (TypeError, ValueError, KeyError) as e:
                     logger.warning(f"WS user {user_id}: Invalid payload for ping_thinking_of_you: {str(e)}. Data: {data}")
                     await websocket.send_json({"event_type": "error", "detail": f"Invalid recipient_user_id for ping: {str(e)}"})
                     continue
            else:
                logger.warning(f"WS user {user_id}: Unknown event_type received: {event_type}")
                await websocket.send_json({"event_type": "error", "detail": f"Unknown event_type: {event_type}"})

    except WebSocketDisconnect:
        logger.info(f"WS user {user_id} disconnected (WebSocketDisconnect received).")
    except Exception as e: 
        logger.error(f"Unexpected error in WebSocket loop for user {user_id}: {str(e)}", exc_info=True)
        # Attempt to close gracefully if not already closed by WebSocketDisconnect
        if websocket.client_state != WebSocketState.DISCONNECTED: # type: ignore
             try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Unexpected server error in message loop")
             except RuntimeError: # Already closing or closed
                pass
    finally: 
        logger.info(f"WS user {user_id} entering finally block. Cleaning up connection.")
        await manager.disconnect(user_id) # Ensure user is removed from active connections list
        offline_now = datetime.now(timezone.utc)
        try:
            # Update user status to offline in DB
            await db_manager.get_table("users").update({
                "is_online": False, 
                "last_seen": offline_now.isoformat()
            }).eq("id", str(user_id)).execute()

            # Fetch mood for accurate presence update
            user_data_for_offline_presence_resp = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
            offline_mood = "Neutral" # Default mood
            if user_data_for_offline_presence_resp and user_data_for_offline_presence_resp.data:
                 offline_mood = user_data_for_offline_presence_resp.data.get("mood", "Neutral")
            
            await manager.broadcast_presence_update_to_relevant_users(user_id, False, offline_now, offline_mood, db_manager)
        except Exception as e:
            logger.error(f"Error during WS disconnect cleanup (DB update/broadcast) for user {user_id}: {str(e)}", exc_info=True)


    