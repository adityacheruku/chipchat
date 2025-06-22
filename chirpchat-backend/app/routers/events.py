
import asyncio
import json
from fastapi import APIRouter, Request, Query, status
from sse_starlette.sse import EventSourceResponse, ServerSentEvent
from typing import List, Dict, Any, Optional

from app.auth.dependencies import try_get_user_from_token
from app.auth.schemas import UserPublic
from app.redis_client import get_redis_client, redis_manager
from app.websocket.manager import BROADCAST_CHANNEL, EVENT_LOG_KEY
from app.utils.logging import logger

router = APIRouter(prefix="/events", tags=["Server-Sent Events"])

async def sse_event_generator(request: Request, current_user: UserPublic):
    """
    Yields server-sent events for a user by listening to the shared Redis broadcast channel.
    This provides a fallback for real-time communication when WebSockets are not available.
    """
    redis = None
    pubsub = None
    user_id_str = str(current_user.id)
    
    try:
        redis = await get_redis_client()
        pubsub = redis.pubsub(ignore_subscribe_messages=True)
        await pubsub.subscribe(BROADCAST_CHANNEL)
        logger.info(f"User {user_id_str} connected via SSE and subscribed to Redis.")
        
        # Signal to the client that the connection is established.
        yield ServerSentEvent(event="sse_connected", data=json.dumps({"status": "ok"}))
        
        while True:
            if await request.is_disconnected():
                logger.info(f"SSE client {user_id_str} disconnected.")
                break
                
            try:
                message = await asyncio.wait_for(pubsub.get_message(timeout=15), timeout=20)
                if message and message["type"] == "message":
                    message_data = json.loads(message["data"])
                    target_user_ids = message_data.get("target_user_ids", [])
                    
                    if user_id_str in target_user_ids:
                        payload = message_data.get("payload", {})
                        event_type = payload.get("event_type", "message")
                        yield ServerSentEvent(event=event_type, data=json.dumps(payload))
                else:
                    # Send a keep-alive ping if no message is received
                    yield ServerSentEvent(event="ping", data="keep-alive")
            except asyncio.TimeoutError:
                 yield ServerSentEvent(event="ping", data="keep-alive")
            except Exception as e:
                logger.error(f"Error in SSE generator loop for user {user_id_str}: {e}", exc_info=True)
                await asyncio.sleep(1)


    except asyncio.CancelledError:
        logger.info(f"SSE generator for user {user_id_str} was cancelled.")
    finally:
        logger.info(f"Closing SSE resources for user {user_id_str}.")
        if pubsub:
            await pubsub.unsubscribe(BROADCAST_CHANNEL)
            await pubsub.close()

@router.get("/subscribe")
async def subscribe_to_events(request: Request, token: Optional[str] = Query(None)):
    """
    Subscribes a client to real-time events using Server-Sent Events (SSE).
    """
    current_user = await try_get_user_from_token(token)
    if not current_user:
        # If auth fails, return an error response that the client can handle,
        # instead of letting FastAPI generate an HTML error page.
        return Response(
            content=json.dumps({"detail": "Authentication failed"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json"
        )
    return EventSourceResponse(sse_event_generator(request, current_user))

@router.get("/sync", response_model=List[Dict[str, Any]])
async def sync_events(
    since: int = Query(0, description="The last sequence number the client has processed."),
    current_user: UserPublic = Depends(get_current_user) # Standard auth is fine here
):
    """
    Retrieves all broadcasted events that have occurred since the provided sequence number.
    This allows clients to catch up on missed events after a disconnection.
    """
    redis = await get_redis_client()
    user_id_str = str(current_user.id)
    
    try:
        # zrange with WITHSCORES returns a flat list [member1, score1, member2, score2, ...]
        # The range `(since` means exclusive (score > since).
        event_score_pairs = await redis.zrange(EVENT_LOG_KEY, f"({since}", "+inf", withscores=True)
        
        authorized_events = []
        for event_json, score in event_score_pairs:
            event_data = json.loads(event_json)
            # The payload contains the sequence number, so add it to the event data for the client.
            payload_with_seq = {**event_data['payload'], 'sequence': int(score)}
            
            if user_id_str in event_data.get('target_user_ids', []):
                authorized_events.append(payload_with_seq)
        
        logger.info(f"Sync request for user {user_id_str} since sequence {since} returned {len(authorized_events)} events.")
        return authorized_events
    except Exception as e:
        logger.error(f"Error during event sync for user {user_id_str}: {e}", exc_info=True)
        return []
