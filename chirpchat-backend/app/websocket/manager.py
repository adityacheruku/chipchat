
from typing import Dict, List, Optional, Any, Tuple 
from uuid import UUID
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime, timezone, timedelta
from app.utils.logging import logger 
from collections import OrderedDict 

CACHE_MAX_SIZE = 100
CACHE_TTL_SECONDS = 60 
GRACEFUL_DISCONNECT_SECONDS = 45 # 45 seconds grace period

class WebSocketConnectionManager:
    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {} 
        self.participant_cache: OrderedDict[str, Tuple[datetime, List[UUID]]] = OrderedDict()
        self.pending_offline_tasks: Dict[UUID, asyncio.Task] = {}


    async def connect(self, websocket: WebSocket, user_id: UUID, db_manager_instance: Any):
        # If there's a pending task to mark this user offline, cancel it
        if user_id in self.pending_offline_tasks:
            task = self.pending_offline_tasks.pop(user_id)
            if not task.done(): # Check if task is not already done/cancelled
                task.cancel()
                logger.info(f"User {user_id} reconnected. Cancelled pending offline task.")
            else:
                logger.info(f"User {user_id} reconnected. Pending offline task was already completed or cancelled.")


        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected via WebSocket. Total connections: {len(self.active_connections)}")
        
        # Mark user as online and broadcast presence (moved from ws_router to here for atomicity with task cancellation)
        now_utc = datetime.now(timezone.utc)
        await db_manager_instance.get_table("users").update({
            "is_online": True, 
            "last_seen": now_utc.isoformat()
        }).eq("id", str(user_id)).execute()
        
        user_data_for_presence_resp = await db_manager_instance.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
        current_mood = "Neutral"
        if user_data_for_presence_resp and user_data_for_presence_resp.data:
            current_mood = user_data_for_presence_resp.data.get("mood", "Neutral")
        
        await self.broadcast_presence_update_to_relevant_users(user_id, True, now_utc, current_mood, db_manager_instance)


    async def schedule_graceful_disconnect(self, user_id: UUID, db_manager_instance: Any):
        if user_id in self.pending_offline_tasks and not self.pending_offline_tasks[user_id].done():
            logger.info(f"User {user_id} already has a pending disconnect task. Not scheduling another.")
            return

        logger.info(f"User {user_id} disconnected from WebSocket. Scheduling offline cleanup in {GRACEFUL_DISCONNECT_SECONDS}s.")
        
        # Remove from active connections immediately, so new connections aren't blocked
        if user_id in self.active_connections:
            self.active_connections.pop(user_id, None)
            logger.info(f"User {user_id} removed from active_connections list. Current active: {len(self.active_connections)}")


        task = asyncio.create_task(self._perform_offline_cleanup(user_id, db_manager_instance))
        self.pending_offline_tasks[user_id] = task


    async def _perform_offline_cleanup(self, user_id: UUID, db_manager_instance: Any):
        try:
            await asyncio.sleep(GRACEFUL_DISCONNECT_SECONDS)
            
            # Check if task was cancelled (e.g., by reconnection)
            if user_id not in self.pending_offline_tasks or self.pending_offline_tasks[user_id].cancelled():
                logger.info(f"Offline cleanup for user {user_id} was cancelled (likely reconnected).")
                if user_id in self.pending_offline_tasks: # Clean up if cancelled but still in dict
                    del self.pending_offline_tasks[user_id]
                return

            logger.info(f"Grace period ended for user {user_id}. Performing offline cleanup.")
            
            offline_now = datetime.now(timezone.utc)
            await db_manager_instance.get_table("users").update({
                "is_online": False, 
                "last_seen": offline_now.isoformat()
            }).eq("id", str(user_id)).execute()
            logger.info(f"User {user_id}: DB updated to is_online=False, last_seen={offline_now.isoformat()}.")

            user_data_for_offline_presence_resp = await db_manager_instance.get_table("users").select("mood").eq("id", str(user_id)).maybe_single().execute()
            offline_mood = "Neutral"
            if user_data_for_offline_presence_resp and user_data_for_offline_presence_resp.data:
                offline_mood = user_data_for_offline_presence_resp.data.get("mood", "Neutral")
            
            await self.broadcast_presence_update_to_relevant_users(user_id, False, offline_now, offline_mood, db_manager_instance)
            logger.info(f"User {user_id}: Broadcasted offline presence.")

        except asyncio.CancelledError:
            logger.info(f"Offline cleanup task for user {user_id} explicitly cancelled.")
        except Exception as e:
            logger.error(f"Error during offline cleanup for user {user_id}: {e}", exc_info=True)
        finally:
            if user_id in self.pending_offline_tasks:
                del self.pending_offline_tasks[user_id]
                logger.info(f"Removed pending offline task for user {user_id}.")


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
        for user_id_to_send in active_user_ids_to_send: 
            websocket = self.active_connections[user_id_to_send]
            tasks.append(websocket.send_json(message_payload))
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed_user_id = active_user_ids_to_send[i]
                    logger.error(f"Error broadcasting to user {failed_user_id}: {result}", exc_info=False) 

    async def _get_chat_participants(self, chat_id: str, db_manager_instance: Any) -> List[UUID]:
        now_utc = datetime.now(timezone.utc)
        if chat_id in self.participant_cache:
            cached_time, participant_ids = self.participant_cache[chat_id]
            if (now_utc - cached_time).total_seconds() < CACHE_TTL_SECONDS:
                self.participant_cache.move_to_end(chat_id) 
                logger.debug(f"Cache hit for participants of chat {chat_id}.")
                return participant_ids
            else:
                logger.debug(f"Cache expired for participants of chat {chat_id}")
                del self.participant_cache[chat_id] 

        logger.debug(f"Cache miss for participants of chat {chat_id}. Fetching from DB.")
        try:
            participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            if not participants_resp or not participants_resp.data:
                logger.warning(f"No participants found in DB for chat_id {chat_id} during cache refresh.")
                self.participant_cache[chat_id] = (now_utc, []) 
                return []
            
            participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
            logger.debug(f"Fetched {len(participant_ids)} participants from DB for chat {chat_id}")
            
            if len(self.participant_cache) >= CACHE_MAX_SIZE:
                self.participant_cache.popitem(last=False) 
            self.participant_cache[chat_id] = (now_utc, participant_ids)
            logger.debug(f"Cached {len(participant_ids)} participants for chat {chat_id}.")
            return participant_ids
        except Exception as e:
            logger.error(f"Database error fetching participants for chat {chat_id}: {e}", exc_info=True)
            return [] 

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
            await self.broadcast_to_users(payload, recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast typing indicator for chat {chat_id}: {e}", exc_info=True)

    async def _get_all_chat_partners_for_user(self, user_id: UUID, db_manager_instance: Any) -> List[UUID]:
        try:
            user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
            if not user_chats_resp or not user_chats_resp.data:
                return []
            chat_ids_user_is_in = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

            if not chat_ids_user_is_in:
                return []

            all_participants_in_those_chats_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids_user_is_in).execute()
            if not all_participants_in_those_chats_resp or not all_participants_in_those_chats_resp.data:
                return []
            
            unique_partner_ids = list(set(
                [UUID(row["user_id"]) for row in all_participants_in_those_chats_resp.data if UUID(row["user_id"]) != user_id]
            ))
            return unique_partner_ids
        except Exception as e:
            logger.error(f"Database error fetching chat partners for user {user_id}: {e}", exc_info=True)
            return []

    async def broadcast_user_update_for_profile_change(self, user_id: UUID, updated_data: dict, db_manager_instance: Any):
        try:
            unique_recipient_ids = await self._get_all_chat_partners_for_user(user_id, db_manager_instance)
            if not unique_recipient_ids:
                logger.info(f"No one to notify about profile update for user {user_id}")
                return

            payload = {
                "event_type": "user_profile_update",
                "user_id": str(user_id),
                **updated_data 
            }
            logger.info(f"Broadcasting user_profile_update for user {user_id} to {len(unique_recipient_ids)} users. Data: {updated_data}")
            await self.broadcast_to_users(payload, unique_recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast user profile update for user {user_id}: {e}", exc_info=True)

    async def broadcast_presence_update_to_relevant_users(self, user_id: UUID, is_online: bool, last_seen: Optional[datetime], mood: str, db_manager_instance: Any):
        try:
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
