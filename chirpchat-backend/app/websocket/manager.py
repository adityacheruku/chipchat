
from typing import Dict, List, Optional, Any
from uuid import UUID
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime, timezone
from app.utils.logging import logger # Ensure logger is imported

# Assuming db_manager can be imported or passed if needed for complex broadcasts
# For simplicity, this manager won't directly use db_manager in broadcast,
# the calling function (e.g., in ws_router or chat_router) will fetch participants.
# from app.database import db_manager # Optional, if manager needs to query DB directly

class WebSocketConnectionManager:
    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {} # Maps user_id to WebSocket

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
        # Caller (e.g., ws_router) should handle DB update for is_online and broadcast presence.

    async def disconnect(self, user_id: UUID):
        if user_id in self.active_connections:
            # websocket = self.active_connections[user_id]
            # try:
            #     # await websocket.close() # Client might have already closed
            # except Exception:
            #     pass # Ignore errors on close
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
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
        for user_id in active_user_ids_to_send:
            websocket = self.active_connections[user_id]
            tasks.append(websocket.send_json(message_payload))
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error broadcasting to user {active_user_ids_to_send[i]}: {result}", exc_info=True)
                    # Optionally, handle disconnect for users where send failed

    async def broadcast_chat_message(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        try:
            participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            if not participants_resp.data:
                logger.warning(f"No participants found for chat_id {chat_id} to broadcast message.")
                return
            participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
            
            payload = {
                "event_type": "new_message",
                "message": message_data.model_dump() if hasattr(message_data, 'model_dump') else message_data,
                "chat_id": chat_id
            }
            await self.broadcast_to_users(payload, participant_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast chat message for chat {chat_id}: {e}", exc_info=True)

    async def broadcast_reaction_update(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        try:
            participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            if not participants_resp.data:
                logger.warning(f"No participants found for chat_id {chat_id} to broadcast reaction.")
                return
            participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
            
            message_id_val = message_data.id if hasattr(message_data, 'id') else message_data.get("id")
            reactions_val = message_data.reactions if hasattr(message_data, 'reactions') else message_data.get("reactions", {})

            payload = {
                "event_type": "message_reaction_update",
                "message_id": str(message_id_val),
                "chat_id": chat_id,
                "reactions": reactions_val,
            }
            await self.broadcast_to_users(payload, participant_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast reaction update for chat {chat_id}: {e}", exc_info=True)

    async def broadcast_typing_indicator(self, chat_id: str, typing_user_id: UUID, is_typing: bool, db_manager_instance: Any):
        try:
            participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
            if not participants_resp.data:
                # This might be okay if a chat has no other active participants to notify
                return
            recipient_ids = [UUID(row["user_id"]) for row in participants_resp.data if UUID(row["user_id"]) != typing_user_id]

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

    async def broadcast_user_update_for_profile_change(self, user_id: UUID, updated_data: dict, db_manager_instance: Any):
        try:
            user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
            if not user_chats_resp.data:
                return
            chat_ids = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

            if not chat_ids:
                return

            all_participants_to_notify_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
            if not all_participants_to_notify_resp.data:
                return
            
            unique_recipient_ids = list(set(
                [UUID(row["user_id"]) for row in all_participants_to_notify_resp.data if UUID(row["user_id"]) != user_id]
            ))

            if not unique_recipient_ids:
                return

            payload = {
                "event_type": "user_profile_update",
                "user_id": str(user_id),
                **updated_data
            }
            await self.broadcast_to_users(payload, unique_recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast user profile update for user {user_id}: {e}", exc_info=True)

    async def broadcast_presence_update_to_relevant_users(self, user_id: UUID, is_online: bool, last_seen: Optional[datetime], mood: str, db_manager_instance: Any):
        try:
            user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
            if not user_chats_resp.data:
                return
            chat_ids = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

            if not chat_ids:
                return

            all_participants_to_notify_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
            if not all_participants_to_notify_resp.data:
                return
                
            unique_recipient_ids = list(set(
                [UUID(row["user_id"]) for row in all_participants_to_notify_resp.data if UUID(row["user_id"]) != user_id]
            ))

            if not unique_recipient_ids:
                return
            
            payload = {
                "event_type": "user_presence_update",
                "user_id": str(user_id),
                "is_online": is_online,
                "last_seen": last_seen.isoformat() if last_seen else None,
                "mood": mood,
            }
            await self.broadcast_to_users(payload, unique_recipient_ids)
        except Exception as e:
            logger.error(f"Failed to broadcast presence update for user {user_id}: {e}", exc_info=True)


manager = WebSocketConnectionManager()
