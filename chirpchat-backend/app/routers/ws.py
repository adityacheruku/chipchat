
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta 
import json
import asyncio

from app.websocket import manager as ws_manager
from app.auth.schemas import UserPublic, TokenData
from app.chat.schemas import MessageCreate, MessageStatusEnum, SUPPORTED_EMOJIS, MessageSubtypeEnum
from app.database import db_manager
from app.utils.logging import logger
from app.notifications.service import notification_service
from app.chat.routes import get_message_with_details_from_db

from app.config import settings
from jose import jwt, JWTError, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError
from starlette.websockets import WebSocketState

router = APIRouter(prefix="/ws", tags=["WebSocket"])

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

    except (JWTError, ValidationError) as e:
        logger.warning(f"WS Auth: Token validation error: {e}")
        return None
    except Exception as e:
        logger.error(f"WS Auth: Unexpected error during token decoding: {e}", exc_info=True)
        return None
    
    user_dict = None
    try:
        if token_data.user_id:
            response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
            user_dict = response.data
    except Exception as e:
        logger.error(f"WS Auth: Database error fetching user: {e}", exc_info=True)
        return None
    
    if user_dict is None:
        logger.warning(f"WS Auth: User not found in DB for token: {token_data}")
        return None
    
    try:
        return UserPublic(**user_dict)
    except ValidationError as e:
        logger.error(f"WS Auth: Pydantic validation error for UserPublic: {e}")
        return None

@router.websocket("/connect") 
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    current_user: Optional[UserPublic] = await get_user_from_token_for_ws(token=token)

    if not current_user:
        await websocket.accept() 
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION) 
        return

    user_id = current_user.id
    
    try:
        await ws_manager.connect(websocket, user_id)
    except Exception as e:
        logger.error(f"Error during WS connect for user {user_id}: {e}", exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return 

    try:
        while True:
            raw_data = await websocket.receive_text() 
            await ws_manager.update_user_last_seen_throttled(user_id)

            try:
                data = json.loads(raw_data)
                event_type = data.get("event_type")
            except (json.JSONDecodeError, AttributeError):
                logger.warning(f"WS user {user_id}: Invalid JSON payload: {raw_data[:100]}") 
                await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": "Invalid JSON payload"})
                continue

            logger.info(f"WS user {user_id}: Received event '{event_type}'")

            try: 
                if event_type == "send_message":
                    await handle_send_message(data, websocket, current_user)
                elif event_type == "toggle_reaction":
                    await handle_toggle_reaction(data, websocket, current_user)
                elif event_type in ["start_typing", "stop_typing"]:
                    await handle_typing_indicator(data, current_user)
                elif event_type == "ping_thinking_of_you":
                    await handle_ping(data, current_user)
                elif event_type == "HEARTBEAT":
                    pass # Activity already updated
                else:
                    logger.warning(f"WS user {user_id}: Unknown event_type: {event_type}")
                    await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": f"Unknown event: {event_type}"})
            
            except (KeyError, ValueError, ValidationError) as e:
                logger.warning(f"WS user {user_id}: Invalid payload for {event_type}: {e}", exc_info=False) 
                await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": f"Invalid payload: {e}"})
            except Exception as e:
                logger.error(f"WS user {user_id}: Error processing event {event_type}: {e}", exc_info=True)
                await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": "Server error processing your request."})

    except WebSocketDisconnect:
        logger.info(f"WS user {user_id} disconnected.")
    except Exception as e:
        logger.error(f"Unexpected error in WS loop for user {user_id}: {e}", exc_info=True)
    finally:
        await ws_manager.disconnect(user_id)


async def handle_send_message(data: Dict[str, Any], websocket: WebSocket, current_user: UserPublic):
    message_create = MessageCreate(**data)
    client_temp_id = message_create.client_temp_id
    user_id = current_user.id

    if not client_temp_id:
        logger.warning(f"WS user {user_id}: Message received without client_temp_id. Ignoring.")
        return

    if await ws_manager.is_message_processed(client_temp_id):
        logger.warning(f"Duplicate message from user {user_id} with client_temp_id: {client_temp_id}")
        await ws_manager.send_ack(websocket, client_temp_id)
        return

    chat_id = message_create.chat_id
    if not chat_id:
        logger.warning(f"WS user {user_id}: send_message event missing chat_id.")
        return

    is_participant = await ws_manager.is_user_in_chat(user_id, chat_id)
    if not is_participant:
        logger.warning(f"User {user_id} not in chat {chat_id}")
        return

    message_db_id = uuid4()
    now = datetime.now(timezone.utc)
    
    message_data_to_insert = {
        "id": str(message_db_id),
        "chat_id": str(chat_id),
        "user_id": str(user_id),
        "text": message_create.text,
        "message_subtype": message_create.message_subtype.value if message_create.message_subtype else 'text',
        "sticker_id": str(message_create.sticker_id) if message_create.sticker_id else None,
        "clip_type": message_create.clip_type.value if message_create.clip_type else None,
        "clip_placeholder_text": message_create.clip_placeholder_text,
        "clip_url": message_create.clip_url,
        "image_url": message_create.image_url,
        "image_thumbnail_url": message_create.image_thumbnail_url,
        "document_url": message_create.document_url,
        "document_name": message_create.document_name,
        "client_temp_id": client_temp_id, 
        "status": MessageStatusEnum.SENT_TO_SERVER.value, 
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "reactions": {},
        "duration_seconds": message_create.duration_seconds,
        "file_size_bytes": message_create.file_size_bytes,
        "audio_format": message_create.audio_format,
        "transcription": message_create.transcription,
    }

    insert_result_obj = await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    if not insert_result_obj.data:
        raise Exception("Failed to save message to DB")
        
    await ws_manager.mark_message_as_processed(client_temp_id)
    await ws_manager.send_ack(websocket, client_temp_id, str(message_db_id))

    await db_manager.get_table("chats").update({"updated_at": now.isoformat()}).eq("id", str(chat_id)).execute()
    
    message_out = await get_message_with_details_from_db(message_db_id)
    if not message_out:
        raise Exception(f"Could not retrieve message details for ID: {message_db_id}")

    await ws_manager.broadcast_chat_message(str(chat_id), message_out)
    
    await notification_service.send_new_message_notification(
        sender=current_user,
        chat_id=chat_id,
        message=message_out
    )

async def handle_toggle_reaction(data: Dict[str, Any], websocket: WebSocket, current_user: UserPublic):
    message_id = UUID(data["message_id"])
    chat_id = UUID(data["chat_id"])
    emoji = data["emoji"]
    user_id = current_user.id

    if emoji not in SUPPORTED_EMOJIS:
        raise ValueError("Unsupported emoji")

    if not await ws_manager.is_user_in_chat(user_id, chat_id):
        raise ValueError("User not in chat")

    msg_resp_obj = await db_manager.get_table("messages").select("reactions, chat_id").eq("id", str(message_id)).maybe_single().execute()
    if not msg_resp_obj.data or str(msg_resp_obj.data["chat_id"]) != str(chat_id):
        raise ValueError("Message not found or not in specified chat")

    reactions = msg_resp_obj.data.get("reactions", {}) or {}
    user_id_str = str(user_id)

    if emoji not in reactions: reactions[emoji] = []
    if user_id_str in reactions[emoji]:
        reactions[emoji].remove(user_id_str)
        if not reactions[emoji]: del reactions[emoji]
    else:
        reactions[emoji].append(user_id_str)
    
    update_result = await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(message_id)).execute()
    if not update_result.data:
        raise Exception("Failed to update reaction")
    
    message_out = await get_message_with_details_from_db(message_id)
    await ws_manager.broadcast_reaction_update(str(chat_id), message_out)


async def handle_typing_indicator(data: Dict[str, Any], current_user: UserPublic):
    chat_id = UUID(data["chat_id"])
    is_typing = data["event_type"] == "start_typing"
    await ws_manager.broadcast_typing_indicator(str(chat_id), current_user.id, is_typing)

async def handle_ping(data: Dict[str, Any], current_user: UserPublic):
    recipient_user_id = UUID(data["recipient_user_id"])
    
    # Verify recipient exists
    recipient_check = await db_manager.get_table("users").select("id").eq("id", str(recipient_user_id)).maybe_single().execute()
    if not recipient_check.data:
        raise ValueError("Recipient user not found")

    await ws_manager.broadcast_to_users(
        user_ids=[recipient_user_id],
        payload={
            "event_type": "thinking_of_you_received",
            "sender_id": str(current_user.id),
            "sender_name": current_user.display_name,
        }
    )
    
    await notification_service.send_thinking_of_you_notification(
        sender=current_user,
        recipient_id=recipient_user_id
    )


