import asyncio
import json
from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.redis_client import get_pubsub_client, get_redis_client
from app.websocket.manager import BROADCAST_CHANNEL, USER_CONNECTIONS_KEY
from app.utils.logging import logger

router = APIRouter(prefix="/events", tags=["Server-Sent Events"])

async def sse_event_generator(request: Request, current_user: UserPublic):
    """
    Yields server-sent events for a user by listening to the shared Redis broadcast channel.
    This provides a fallback for real-time communication when WebSockets are not available.
    """
    redis = await get_redis_client()
    pubsub = await get_pubsub_client()
    user_id_str = str(current_user.id)
    
    # Register user's SSE connection in Redis. The value helps identify the connection type.
    await redis.hset(USER_CONNECTIONS_KEY, user_id_str, "sse-instance")
    logger.info(f"User {user_id_str} connected via SSE.")
    
    await pubsub.subscribe(BROADCAST_CHANNEL)
    
    try:
        # First, send a welcome event to confirm connection
        yield {"event": "sse_connected", "data": json.dumps({"status": "ok"})}
        
        while True:
            # Check if the client has disconnected
            if await request.is_disconnected():
                logger.info(f"SSE client {user_id_str} disconnected.")
                break
                
            # Wait for a message from the Redis channel with a timeout
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
            if message and message["type"] == "message":
                message_data = json.loads(message["data"])
                target_user_ids = message_data.get("target_user_ids", [])
                
                # If the current user is a target, send the event
                if user_id_str in target_user_ids:
                    payload = message_data.get("payload", {})
                    event_type = payload.get("event_type", "message")
                    
                    # SSE format requires event and data fields
                    yield {
                        "event": event_type,
                        "data": json.dumps(payload)
                    }
            else:
                # If no message, send a keep-alive comment to prevent connection timeout
                yield {"event": "ping", "data": "keep-alive"}

    except asyncio.CancelledError:
        logger.info(f"SSE generator for user {user_id_str} was cancelled.")
    finally:
        logger.info(f"Closing SSE resources for user {user_id_str}.")
        # Clean up Redis resources
        await pubsub.unsubscribe(BROADCAST_CHANNEL)
        await redis.hdel(USER_CONNECTIONS_KEY, user_id_str)

@router.get("/subscribe", response_model=None)
async def subscribe_to_events(
    request: Request,
    current_user: UserPublic = Depends(get_current_user)
):
    """
    Subscribes a client to real-time events using Server-Sent Events (SSE).
    Authentication is handled via a token in the query string.
    """
    return EventSourceResponse(sse_event_generator(request, current_user))
