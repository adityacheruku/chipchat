
import asyncio
import json
from uuid import UUID
from typing import Dict, List, Any, Optional
from fastapi import WebSocket

from app.config import settings
from app.utils.logging import logger
from app.database import db_manager
from app.redis_client import get_redis_client, get_pubsub_client
from app.chat.schemas import MessageStatusEnum

# --- Redis Key Schemas ---
# Hash: user_connections | field: user_id | value: server_instance_id
USER_CONNECTIONS_KEY = "user_connections"
# Channel for broadcasting messages across instances
BROADCAST_CHANNEL = "chirpchat:broadcast"
# Key for deduplicating messages, with a TTL. e.g., processed_messages:<client_temp_id>
PROCESSED_MESSAGES_PREFIX = "processed_messages:"
# TTL for processed message IDs to prevent Redis from filling up
PROCESSED_MESSAGE_TTL_SECONDS = 300 # 5 minutes

# --- Local Connection Storage ---
# This server instance's unique ID
SERVER_ID = settings.SERVER_INSTANCE_ID
# Dictionary mapping user_id to their WebSocket object for users connected to THIS instance
active_local_connections: Dict[UUID, WebSocket] = {}
# Throttled last seen updates for users on this instance
user_last_activity_update_db: Dict[UUID, Any] = {}
THROTTLE_LAST_SEEN_UPDATE_SECONDS = 120 # 2 minutes


async def connect(websocket: WebSocket, user_id: UUID):
    await websocket.accept()
    redis = await get_redis_client()
    active_local_connections[user_id] = websocket
    
    # Register this user's connection to this server instance in Redis
    await redis.hset(USER_CONNECTIONS_KEY, str(user_id), SERVER_ID)
    
    # Update presence and broadcast
    now_utc = await db_manager.get_table("users").update({
        "is_online": True, 
        "last_seen": "now()"
    }).eq("id", str(user_id)).execute()
    
    user_mood = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
    
    await broadcast_presence_update(
        user_id,
        is_online=True,
        mood=user_mood.data.get('mood', 'Neutral') if user_mood.data else 'Neutral'
    )
    logger.info(f"User {user_id} connected to instance {SERVER_ID}. Total local connections: {len(active_local_connections)}")

async def disconnect(user_id: UUID):
    if user_id in active_local_connections:
        del active_local_connections[user_id]
    
    redis = await get_redis_client()
    await redis.hdel(USER_CONNECTIONS_KEY, str(user_id))
    
    await db_manager.get_table("users").update({
        "is_online": False,
        "last_seen": "now()"
    }).eq("id", str(user_id)).execute()
    
    user_mood = await db_manager.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()

    await broadcast_presence_update(
        user_id,
        is_online=False,
        mood=user_mood.data.get('mood', 'Neutral') if user_mood.data else 'Neutral'
    )
    logger.info(f"User {user_id} disconnected from instance {SERVER_ID}.")

async def send_personal_message(websocket: WebSocket, payload: dict):
    try:
        await websocket.send_json(payload)
    except Exception as e:
        logger.error(f"Failed to send personal message: {e}", exc_info=True)

# --- Message Deduplication ---
async def is_message_processed(client_temp_id: str) -> bool:
    redis = await get_redis_client()
    return await redis.exists(f"{PROCESSED_MESSAGES_PREFIX}{client_temp_id}")

async def mark_message_as_processed(client_temp_id: str):
    redis = await get_redis_client()
    await redis.set(f"{PROCESSED_MESSAGES_PREFIX}{client_temp_id}", "1", ex=PROCESSED_MESSAGE_TTL_SECONDS)

async def send_ack(websocket: WebSocket, client_temp_id: str, server_id: Optional[str] = None):
    ack_payload = {
        "event_type": "message_ack",
        "client_temp_id": client_temp_id,
        "server_assigned_id": server_id or client_temp_id,
        "status": MessageStatusEnum.SENT_TO_SERVER.value,
        "timestamp": "now()",
    }
    await send_personal_message(websocket, ack_payload)

# --- Broadcast Logic using Redis Pub/Sub ---
async def broadcast_to_users(user_ids: List[UUID], payload: Dict[str, Any]):
    redis = await get_redis_client()
    message_to_publish = {
        "target_user_ids": [str(uid) for uid in user_ids],
        "payload": payload
    }
    await redis.publish(BROADCAST_CHANNEL, json.dumps(message_to_publish))

async def _get_chat_participants(chat_id: str) -> List[UUID]:
    try:
        participants_resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
        return [UUID(row["user_id"]) for row in participants_resp.data] if participants_resp.data else []
    except Exception as e:
        logger.error(f"DB error fetching participants for chat {chat_id}: {e}", exc_info=True)
        return []

async def broadcast_chat_message(chat_id: str, message_data: Any):
    participant_ids = await _get_chat_participants(chat_id)
    payload = {
        "event_type": "new_message",
        "message": message_data.model_dump(),
        "chat_id": chat_id
    }
    if participant_ids:
        await broadcast_to_users(participant_ids, payload)

async def broadcast_reaction_update(chat_id: str, message_data: Any):
    participant_ids = await _get_chat_participants(chat_id)
    payload = {
        "event_type": "message_reaction_update",
        "message_id": str(message_data.id),
        "chat_id": chat_id,
        "reactions": message_data.reactions,
    }
    if participant_ids:
        await broadcast_to_users(participant_ids, payload)

async def broadcast_typing_indicator(chat_id: str, typing_user_id: UUID, is_typing: bool):
    recipients = [pid for pid in await _get_chat_participants(chat_id) if pid != typing_user_id]
    payload = {
        "event_type": "typing_indicator",
        "chat_id": chat_id,
        "user_id": str(typing_user_id),
        "is_typing": is_typing,
    }
    if recipients:
        await broadcast_to_users(recipients, payload)

async def broadcast_presence_update(user_id: UUID, is_online: bool, mood: str):
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
    if not user_chats_resp.data: return

    chat_ids = [row["chat_id"] for row in user_chats_resp.data]
    recipients_resp = await db_manager.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
    if not recipients_resp.data: return
    
    unique_recipients = {UUID(row["user_id"]) for row in recipients_resp.data if UUID(row["user_id"]) != user_id}
    payload = {
        "event_type": "user_presence_update",
        "user_id": str(user_id),
        "is_online": is_online,
        "last_seen": "now()",
        "mood": mood,
    }
    if unique_recipients:
        await broadcast_to_users(list(unique_recipients), payload)

async def broadcast_user_profile_update(user_id: UUID, updated_data: dict):
     # Same logic as presence update to find recipients
    user_chats_resp = await db_manager.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
    if not user_chats_resp.data: return
    chat_ids = [row["chat_id"] for row in user_chats_resp.data]
    recipients_resp = await db_manager.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
    if not recipients_resp.data: return
    unique_recipients = {UUID(row["user_id"]) for row in recipients_resp.data if UUID(row["user_id"]) != user_id}

    payload = {"event_type": "user_profile_update", "user_id": str(user_id), **updated_data}
    if unique_recipients:
        await broadcast_to_users(list(unique_recipients), payload)


# --- Pub/Sub Listener ---
async def listen_for_broadcasts():
    pubsub = await get_pubsub_client()
    await pubsub.subscribe(BROADCAST_CHANNEL)
    logger.info(f"Instance {SERVER_ID} subscribed to Redis channel '{BROADCAST_CHANNEL}'.")
    while True:
        try:
            message = await pubsub.get_message(timeout=None)
            if message:
                message_data = json.loads(message["data"])
                target_user_ids = [UUID(uid) for uid in message_data["target_user_ids"]]
                payload = message_data["payload"]
                
                # Send to users connected to THIS instance
                locally_connected_targets = [uid for uid in target_user_ids if uid in active_local_connections]
                
                tasks = []
                for user_id in locally_connected_targets:
                    websocket = active_local_connections[user_id]
                    tasks.append(send_personal_message(websocket, payload))
                
                if tasks:
                    await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error in Redis Pub/Sub listener on instance {SERVER_ID}: {e}", exc_info=True)
            # Short sleep to prevent rapid-fire errors on persistent connection issue
            await asyncio.sleep(1)


# --- Utility Functions ---
async def update_user_last_seen_throttled(user_id: UUID):
    now = asyncio.get_event_loop().time()
    last_update = user_last_activity_update_db.get(user_id)
    if not last_update or (now - last_update) > THROTTLE_LAST_SEEN_UPDATE_SECONDS:
        try:
            await db_manager.get_table("users").update({"last_seen": "now()"}).eq("id", str(user_id)).execute()
            user_last_activity_update_db[user_id] = now
        except Exception as e:
            logger.error(f"Error in throttled last_seen update for {user_id}: {e}")

async def is_user_in_chat(user_id: UUID, chat_id: UUID) -> bool:
    resp = await db_manager.get_table("chat_participants").select("user_id").eq("chat_id", str(chat_id)).eq("user_id", str(user_id)).maybe_single().execute()
    return bool(resp.data)
