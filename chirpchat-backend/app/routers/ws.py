
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timezone
import json
import asyncio

from app.websocket import manager as ws_manager
from app.auth.schemas import UserPublic
from app.auth.dependencies import try_get_user_from_token
from app.chat.schemas import MessageCreate, MessageStatusEnum, SUPPORTED_EMOJIS, MessageModeEnum, MessageInDB
from app.database import db_manager
from app.utils.logging import logger
from app.notifications.service import notification_service
from app.chat.routes import get_message_with_details_from_db
from pydantic import ValidationError
from starlette.websockets import WebSocketState

router = APIRouter(prefix="/ws", tags=["WebSocket"])

@router.websocket("/connect") 
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    current_user: Optional[UserPublic] = await try_get_user_from_token(token, "access")
    if not current_user:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or missing token")
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
                await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": "Invalid JSON payload"})
                continue

            try: 
                if event_type == "send_message": await handle_send_message(data, websocket, current_user)
                elif event_type == "toggle_reaction": await handle_toggle_reaction(data, current_user)
                elif event_type in ["start_typing", "stop_typing"]: await handle_typing_indicator(data, current_user)
                elif event_type == "ping_thinking_of_you": await handle_ping(data, current_user)
                elif event_type == "change_chat_mode": await handle_change_chat_mode(data, current_user)
                elif event_type == "HEARTBEAT": await ws_manager.send_personal_message(websocket, {"event_type": "heartbeat_ack"})
                else: await ws_manager.send_personal_message(websocket, {"event_type": "error", "detail": f"Unknown event: {event_type}"})
            except (KeyError, ValueError, ValidationError) as e:
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
    client_temp_id, user_id, chat_id = message_create.client_temp_id, current_user.id, message_create.chat_id
    if not client_temp_id or not chat_id: return
    if await ws_manager.is_message_processed(client_temp_id):
        await ws_manager.send_ack(websocket, client_temp_id)
        return
    if not await ws_manager.is_user_in_chat(user_id, chat_id): return
    
    now, message_db_id = datetime.now(timezone.utc), uuid4()
    if message_create.mode == MessageModeEnum.INCOGNITO:
        incognito_message = MessageInDB(id=message_db_id, chat_id=chat_id, user_id=user_id, status=MessageStatusEnum.SENT, created_at=now, updated_at=now, reactions={}, **message_create.model_dump(exclude={'chat_id', 'recipient_id'}))
        await ws_manager.mark_message_as_processed(client_temp_id)
        await ws_manager.send_ack(websocket, client_temp_id, str(message_db_id))
        await ws_manager.broadcast_chat_message(str(chat_id), incognito_message)
        return

    message_data_to_insert = message_create.model_dump(exclude_unset=True, exclude={'chat_id', 'recipient_id', 'client_temp_id'})
    message_data_to_insert.update({
        "id": str(message_db_id), "chat_id": str(chat_id), "user_id": str(user_id),
        "status": MessageStatusEnum.SENT.value, "created_at": "now()", "updated_at": "now()", "reactions": {},
        "client_temp_id": client_temp_id
    })
    
    # Ensure UUIDs are strings for DB insert if they exist
    if 'sticker_id' in message_data_to_insert and message_data_to_insert['sticker_id']:
        message_data_to_insert['sticker_id'] = str(message_data_to_insert['sticker_id'])
    if 'reply_to_message_id' in message_data_to_insert and message_data_to_insert['reply_to_message_id']:
        message_data_to_insert['reply_to_message_id'] = str(message_data_to_insert['reply_to_message_id'])

    await db_manager.get_table("messages").insert(message_data_to_insert).execute()
    await ws_manager.mark_message_as_processed(client_temp_id)
    await ws_manager.send_ack(websocket, client_temp_id, str(message_db_id))
    await db_manager.get_table("chats").update({"updated_at": "now()"}).eq("id", str(chat_id)).execute()
    
    message_out = await get_message_with_details_from_db(message_db_id)
    if not message_out: raise Exception(f"Could not retrieve message details for ID: {message_db_id}")
    await ws_manager.broadcast_chat_message(str(chat_id), message_out)
    await notification_service.send_new_message_notification(sender=current_user, chat_id=chat_id, message=message_out)

async def handle_toggle_reaction(data: Dict[str, Any], current_user: UserPublic):
    message_id, chat_id, emoji, user_id = UUID(data["message_id"]), UUID(data["chat_id"]), data["emoji"], current_user.id
    if emoji not in SUPPORTED_EMOJIS or not await ws_manager.is_user_in_chat(user_id, chat_id): return

    msg_resp = await db_manager.get_table("messages").select("reactions, chat_id, mode").eq("id", str(message_id)).maybe_single().execute()
    if not msg_resp.data or str(msg_resp.data["chat_id"]) != str(chat_id) or msg_resp.data.get("mode") == MessageModeEnum.INCOGNITO.value: return

    reactions, user_id_str = msg_resp.data.get("reactions", {}) or {}, str(user_id)
    if emoji not in reactions: reactions[emoji] = []
    if user_id_str in reactions[emoji]: reactions[emoji].remove(user_id_str)
    else: reactions[emoji].append(user_id_str)
    if not reactions[emoji]: del reactions[emoji]
    
    await db_manager.get_table("messages").update({"reactions": reactions, "updated_at": "now()"}).eq("id", str(message_id)).execute()
    message_out = await get_message_with_details_from_db(message_id)
    await ws_manager.broadcast_reaction_update(str(chat_id), message_out)

async def handle_typing_indicator(data: Dict[str, Any], current_user: UserPublic):
    await ws_manager.broadcast_typing_indicator(str(data["chat_id"]), current_user.id, data["event_type"] == "start_typing")

async def handle_ping(data: Dict[str, Any], current_user: UserPublic):
    recipient_user_id = UUID(data["recipient_user_id"])
    recipient_check = await db_manager.get_table("users").select("id").eq("id", str(recipient_user_id)).maybe_single().execute()
    if not recipient_check.data: return
    await ws_manager.broadcast_to_users(user_ids=[recipient_user_id], payload={"event_type": "thinking_of_you_received", "sender_id": str(current_user.id), "sender_name": current_user.display_name})
    await notification_service.send_thinking_of_you_notification(sender=current_user, recipient_id=recipient_user_id)

async def handle_change_chat_mode(data: Dict[str, Any], current_user: UserPublic):
    chat_id, mode = UUID(data["chat_id"]), data["mode"]
    if mode not in [m.value for m in MessageModeEnum] or not await ws_manager.is_user_in_chat(current_user.id, chat_id): return
    await ws_manager.broadcast_chat_mode_update(str(chat_id), mode)
