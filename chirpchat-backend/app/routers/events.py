
import asyncio
import json
from fastapi import APIRouter, Depends, Request, Query
from sse_starlette.sse import EventSourceResponse
from typing import List, Dict, Any

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.redis_client import get_redis_client, get_pubsub_client, redis_manager
from app.websocket.manager import BROADCAST_CHANNEL, USER_CONNECTIONS_KEY, EVENT_LOG_KEY
from app.utils.logging import logger

router = APIRouter(prefix="/events", tags=["Server-Sent Events"])

async def sse_event_generator(request: Request, current_user: UserPublic):
    """
    Yields server-sent events for a user by listening to the shared Redis broadcast channel.
    This provides a fallback for real-time communication when WebSockets are not available.
    """
    redis = await get_redis_client()
    # Each SSE connection needs its own PubSub instance.
    pubsub = redis.pubsub(ignore_subscribe_messages=True)
    user_id_str = str(current_user.id)
    
    await redis.hset(USER_CONNECTIONS_KEY, user_id_str, "sse-instance")
    logger.info(f"User {user_id_str} connected via SSE.")
    
    await pubsub.subscribe(BROADCAST_CHANNEL)
    
    try:
        yield {"event": "sse_connected", "data": json.dumps({"status": "ok"})}
        
        while True:
            if await request.is_disconnected():
                logger.info(f"SSE client {user_id_str} disconnected.")
                break
                
            message = await pubsub.get_message(timeout=15)
            if message and message["type"] == "message":
                message_data = json.loads(message["data"])
                target_user_ids = message_data.get("target_user_ids", [])
                
                if user_id_str in target_user_ids:
                    payload = message_data.get("payload", {})
                    event_type = payload.get("event_type", "message")
                    yield {"event": event_type, "data": json.dumps(payload)}
            else:
                yield {"event": "ping", "data": "keep-alive"}

    except asyncio.CancelledError:
        logger.info(f"SSE generator for user {user_id_str} was cancelled.")
    finally:
        logger.info(f"Closing SSE resources for user {user_id_str}.")
        await pubsub.unsubscribe(BROADCAST_CHANNEL)
        await pubsub.close()
        await redis.hdel(USER_CONNECTIONS_KEY, user_id_str)

@router.get("/subscribe", response_model=None)
async def subscribe_to_events(
    request: Request,
    current_user: UserPublic = Depends(get_current_user)
):
    """
    Subscribes a client to real-time events using Server-Sent Events (SSE).
    """
    return EventSourceResponse(sse_event_generator(request, current_user))

@router.get("/sync", response_model=List[Dict[str, Any]])
async def sync_events(
    since: int = Query(0, description="The last sequence number the client has processed."),
    current_user: UserPublic = Depends(get_current_user)
):
    """
    Retrieves all broadcasted events that have occurred since the provided sequence number.
    This allows clients to catch up on missed events after a disconnection.
    """
    redis = await get_redis_client()
    user_id_str = str(current_user.id)
    
    # Use zrange with WITHSCORES to get events and their sequence numbers.
    # The `(` prefix on `since` makes the range exclusive (sequence > since).
    try:
        event_tuples = await redis.zrange(EVENT_LOG_KEY, f"({since}", "+inf", byscore=True)
        
        # event_tuples is a flat list [event1, score1, event2, score2, ...]
        # We need to parse and filter it.
        authorized_events = []
        for i in range(0, len(event_tuples), 2):
            event_json = event_tuples[i]
            event_data = json.loads(event_json)
            if user_id_str in event_data.get('target_user_ids', []):
                authorized_events.append(event_data['payload'])
        
        logger.info(f"Sync request for user {user_id_str} since sequence {since} returned {len(authorized_events)} events.")
        return authorized_events
    except Exception as e:
        logger.error(f"Error during event sync for user {user_id_str}: {e}", exc_info=True)
        return []
