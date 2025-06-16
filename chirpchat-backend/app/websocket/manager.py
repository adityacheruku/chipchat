
from typing import Dict, List, Optional, Any, Tuple # Added Tuple
from uuid import UUID
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime, timezone
from app.utils.logging import logger # Ensure logger is imported
from collections import OrderedDict # For LRU cache

# Assuming db_manager can be imported or passed if needed for complex broadcasts
# For simplicity, this manager won't directly use db_manager in broadcast,
# the calling function (e.g., in ws_router or chat_router) will fetch participants.
# from app.database import db_manager # Optional, if manager needs to query DB directly

CACHE_MAX_SIZE = 100
CACHE_TTL_SECONDS = 60 # Cache participant lists for 1 minute

class WebSocketConnectionManager:
    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {} # Maps user_id to WebSocket
        # Cache: chat_id -> (timestamp_cached, list_of_participant_uuids)
        self.participant_cache: OrderedDict[str, Tuple[datetime, List[UUID]]] = OrderedDict()


    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected via WebSocket. Total connections: {len(self.active_connections)}")
        # Caller (e.g., ws_router) should handle DB update for is_online and broadcast presence.

    async def disconnect(self, user_id: UUID):
        if user_id in self.active_connections:
            # websocket_to_close = self.active_connections.pop(user_id, None) # Remove and get
            # if websocket_to_close:
            #     try:
            #         # Ensure the socket is still open before trying to close
            #         # if websocket_to_close.client_state != WebSocketState.DISCONNECTED:
            #         # await websocket_to_close.close() # Client might have already closed or error occurs here
            #         pass # Let FastAPI handle actual closing from endpoint
            #     except Exception as e:
            #         logger.warning(f"Exception while trying to explicitly close WebSocket for user {user_id} during disconnect: {e}")
            #         pass # Ignore errors on close, connection might already be severed
            self.active_connections.pop(user_id, None) # Just remove from tracking
            logger.info(f"User {user_id} disconnected from WebSocket. Total connections: {len(self.active_connections)}")
        else:
            logger.info(f"User {user_id} requested disconnect, but was not found in active WebSocket connections.")
        # Caller (e.g., ws_router) should handle DB update for is_online and broadcast presence.

    async def send_personal_message_by_user_id(self, message_payload: dict, user_id: UUID):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message_payload)
            except Exception as e:
                logger.error(f"Error sending personal message to {user_id}: {e}", exc_info=True)
                # Potentially handle disconnect if send fails consistently

    async def broadcast_to_users(self, message_payload: dict, user_ids: List[UUID]):
        active_user_ids_to_send = [uid for uid in user_ids if uid in self.active_connections]
        
        tasks = []
        for user_id_to_send in active_user_ids_to_send: # Renamed user_id to user_id_to_send to avoid conflict
            websocket = self.active_connections[user_id_to_send]
            tasks.append(websocket.send_json(message_payload))
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed_user_id = active_user_ids_to_send[i]
                    logger.error(f"Error broadcasting to user {failed_user_id}: {result}", exc_info=False) # exc_info=False to reduce log spam for common send errors
                    # Optionally, handle disconnect for users where send failed, or mark them as suspect
                    # e.g., self.handle_failed_send(failed_user_id, result)

    async def _get_chat_participants(self, chat_id: str, db_manager_instance: Any) -> List[UUID]:
        now_utc = datetime.now(timezone.utc)
        # Check cache
        if chat_id in self.participant_cache:
            cached_time, participant_ids = self.participant_cache[chat_id]
            if (now_utc - cached_time).total_seconds() < CACHE_TTL_SECONDS:
                self.participant_cache.move_to_end(chat_id) # Mark as recently used for LRU
                logger.info(f"Cache hit for participants of chat {chat_id}. Participants: {[str(pid) for pid in participant_ids]}")
                return participant_ids
            else:
                logger.info(f"Cache expired for participants of chat {chat_id}")
                del self.participant_cache[chat_id] # Remove expired entry

        # Fetch from DB
        logger.info(f"Cache miss for participants of chat {chat_id}. Fetching from DB.")
        try:
            participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            if not participants_resp or not participants_resp.data:
                logger.warning(f"No participants found in DB for chat_id {chat_id} during cache refresh.")
                self.participant_cache[chat_id] = (now_utc, []) # Cache empty list
                return []
            
            participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
            logger.info(f"Fetched {len(participant_ids)} participants from DB for chat {chat_id}: {[str(pid) for pid in participant_ids]}")
            
            # Update cache
            if len(self.participant_cache) >= CACHE_MAX_SIZE:
                self.participant_cache.popitem(last=False) # Remove oldest item (LRU)
            self.participant_cache[chat_id] = (now_utc, participant_ids)
            logger.info(f"Cached {len(participant_ids)} participants for chat {chat_id}.")
            return participant_ids
        except Exception as e:
            logger.error(f"Database error fetching participants for chat {chat_id}: {e}", exc_info=True)
            return [] # Return empty list on DB error to prevent crashes, error is logged

    async def broadcast_chat_message(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        try:
            participant_ids = await self._get_chat_participants(chat_id, db_manager_instance)
            if not participant_ids:
                logger.info(f"No participants found or cache empty for chat_id {chat_id} to broadcast message.")
                return
            
            payload = {
                "event_type": "new_message",
                "message": message_data.model_dump() if hasattr(message_data, 'model_dump') else message_data,
                "chat_id": chat_id
            }
            logger.info(f"Broadcasting new_message to chat {chat_id} for participants: {[str(pid) for pid in participant_ids]}. Message ID: {payload['message'].get('id', 'N/A')}")
            await self.broadcast_to_users(payload, participant_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast chat message for chat {chat_id}: {e}", exc_info=True)

    async def broadcast_reaction_update(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        try:
            participant_ids = await self._get_chat_participants(chat_id, db_manager_instance)
            if not participant_ids:
                logger.info(f"No participants found or cache empty for chat_id {chat_id} to broadcast reaction.")
                return
            
            message_id_val = message_data.id if hasattr(message_data, 'id') else message_data.get("id")
            reactions_val = message_data.reactions if hasattr(message_data, 'reactions') else message_data.get("reactions", {})

            payload = {
                "event_type": "message_reaction_update",
                "message_id": str(message_id_val),
                "chat_id": chat_id,
                "reactions": reactions_val,
            }
            logger.info(f"Broadcasting reaction_update to chat {chat_id} for msg {message_id_val}. Participants: {[str(pid) for pid in participant_ids]}")
            await self.broadcast_to_users(payload, participant_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast reaction update for chat {chat_id}: {e}", exc_info=True)

    async def broadcast_typing_indicator(self, chat_id: str, typing_user_id: UUID, is_typing: bool, db_manager_instance: Any):
        try:
            all_participant_ids = await self._get_chat_participants(chat_id, db_manager_instance)
            if not all_participant_ids:
                return

            recipient_ids = [pid for pid in all_participant_ids if pid != typing_user_id]
            if not recipient_ids:
                return

            payload = {
                "event_type": "typing_indicator",
                "chat_id": chat_id,
                "user_id": str(typing_user_id),
                "is_typing": is_typing,
            }
            # logger.info(f"Broadcasting typing_indicator to chat {chat_id} (is_typing: {is_typing}) for user {typing_user_id}. Recipients: {[str(pid) for pid in recipient_ids]}")
            await self.broadcast_to_users(payload, recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast typing indicator for chat {chat_id}: {e}", exc_info=True)

    async def _get_all_chat_partners_for_user(self, user_id: UUID, db_manager_instance: Any) -> List[UUID]:
        # This helper method consolidates logic to find all users this user has chats with.
        # For performance, this could also be cached if user_id -> list_of_chat_ids is very stable
        # or if user_id -> list_of_all_partners is needed frequently.
        try:
            # 1. Find all chat_ids this user is part of
            user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
            if not user_chats_resp or not user_chats_resp.data:
                return []
            chat_ids_user_is_in = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

            if not chat_ids_user_is_in:
                return []

            # 2. Find all participants in THOSE chats
            all_participants_in_those_chats_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids_user_is_in).execute()
            if not all_participants_in_those_chats_resp or not all_participants_in_those_chats_resp.data:
                return []
            
            # 3. Collect unique user_ids, excluding the original user_id
            unique_partner_ids = list(set(
                [UUID(row["user_id"]) for row in all_participants_in_those_chats_resp.data if UUID(row["user_id"]) != user_id]
            ))
            return unique_partner_ids
        except Exception as e:
            logger.error(f"Database error fetching chat partners for user {user_id}: {e}", exc_info=True)
            return []

    async def broadcast_user_update_for_profile_change(self, user_id: UUID, updated_data: dict, db_manager_instance: Any):
        try:
            # Notify all users who share a chat with the updated user
            unique_recipient_ids = await self._get_all_chat_partners_for_user(user_id, db_manager_instance)
            if not unique_recipient_ids:
                logger.info(f"No one to notify about profile update for user {user_id}")
                return

            payload = {
                "event_type": "user_profile_update",
                "user_id": str(user_id),
                **updated_data # e.g. {"mood": "Happy", "avatar_url": "..."}
            }
            logger.info(f"Broadcasting user_profile_update for user {user_id} to {len(unique_recipient_ids)} users. Data: {updated_data}")
            await self.broadcast_to_users(payload, unique_recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast user profile update for user {user_id}: {e}", exc_info=True)

    async def broadcast_presence_update_to_relevant_users(self, user_id: UUID, is_online: bool, last_seen: Optional[datetime], mood: str, db_manager_instance: Any):
        try:
            # Notify all users who share a chat with the user whose presence changed
            unique_recipient_ids = await self._get_all_chat_partners_for_user(user_id, db_manager_instance)
            if not unique_recipient_ids:
                logger.info(f"No one to notify about presence update for user {user_id}")
                return
            
            payload = {
                "event_type": "user_presence_update",
                "user_id": str(user_id),
                "is_online": is_online,
                "last_seen": last_seen.isoformat() if last_seen else None,
                "mood": mood,
            }
            logger.info(f"Broadcasting user_presence_update for user {user_id} (online: {is_online}) to {len(unique_recipient_ids)} users.")
            await self.broadcast_to_users(payload, unique_recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast presence update for user {user_id}: {e}", exc_info=True)

manager = WebSocketConnectionManager()

    

    