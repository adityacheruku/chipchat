
from typing import Dict, List, Optional, Any
from uuid import UUID
from fastapi import WebSocket
import asyncio
import json
from datetime import datetime, timezone

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
        print(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
        # Caller (e.g., ws_router) should handle DB update for is_online and broadcast presence.

    async def disconnect(self, user_id: UUID):
        if user_id in self.active_connections:
            # websocket = self.active_connections[user_id]
            # try:
            #     # await websocket.close() # Client might have already closed
            # except Exception:
            #     pass # Ignore errors on close
            del self.active_connections[user_id]
            print(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
        # Caller (e.g., ws_router) should handle DB update for is_online and broadcast presence.

    async def send_personal_message_by_user_id(self, message_payload: dict, user_id: UUID):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message_payload)
            except Exception as e:
                print(f"Error sending personal message to {user_id}: {e}")
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
                    print(f"Error broadcasting to user {active_user_ids_to_send[i]}: {result}")
                    # Optionally, handle disconnect for users where send failed

    # The following methods rely on the caller to fetch participants and then call broadcast_to_users
    async def broadcast_chat_message(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        """
        Broadcasts a new message to all participants of a chat.
        `message_data` should be a Pydantic model instance (e.g., MessageInDB) or dict.
        `db_manager_instance` is passed to fetch participants.
        """
        participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
        participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
        
        payload = {
            "event_type": "new_message",
            "message": message_data.model_dump() if hasattr(message_data, 'model_dump') else message_data,
            "chat_id": chat_id # Include chat_id for context
        }
        await self.broadcast_to_users(payload, participant_ids)

    async def broadcast_reaction_update(self, chat_id: str, message_data: Any, db_manager_instance: Any):
        """
        Broadcasts a message reaction update.
        `message_data` (updated message) should be a Pydantic model or dict.
        """
        participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
        participant_ids = [UUID(row["user_id"]) for row in participants_resp.data]
        
        payload = {
            "event_type": "message_reaction_update",
            "message_id": str(message_data.id if hasattr(message_data, 'id') else message_data.get("id")),
            "chat_id": chat_id,
            "reactions": message_data.reactions if hasattr(message_data, 'reactions') else message_data.get("reactions", {}),
        }
        await self.broadcast_to_users(payload, participant_ids)

    async def broadcast_typing_indicator(self, chat_id: str, typing_user_id: UUID, is_typing: bool, db_manager_instance: Any):
        participants_resp = await db_manager_instance.get_table("chat_participants").select("user_id").eq("chat_id", chat_id).execute()
        # Exclude the typing user from recipients
        recipient_ids = [UUID(row["user_id"]) for row in participants_resp.data if UUID(row["user_id"]) != typing_user_id]

        payload = {
            "event_type": "typing_indicator",
            "chat_id": chat_id,
            "user_id": str(typing_user_id),
            "is_typing": is_typing,
        }
        await self.broadcast_to_users(payload, recipient_ids)

    async def broadcast_user_update_for_profile_change(self, user_id: UUID, updated_data: dict, db_manager_instance: Any):
        """
        Broadcasts that a user's profile (e.g., mood, display_name, avatar) has changed.
        `updated_data` contains only the changed fields, e.g., {"mood": "Happy"}
        """
        # Fetch all chats this user is a part of
        user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
        chat_ids = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

        if not chat_ids:
            return

        # Fetch all participants of these chats to notify them
        all_participants_to_notify_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
        
        # Get unique list of users to notify, excluding the user who changed their profile
        unique_recipient_ids = list(set(
            [UUID(row["user_id"]) for row in all_participants_to_notify_resp.data if UUID(row["user_id"]) != user_id]
        ))

        if not unique_recipient_ids:
            return

        payload = {
            "event_type": "user_profile_update", # A more general event type
            "user_id": str(user_id),
            **updated_data # e.g., "mood": "Happy"
        }
        await self.broadcast_to_users(payload, unique_recipient_ids)

    async def broadcast_presence_update_to_relevant_users(self, user_id: UUID, is_online: bool, last_seen: Optional[datetime], mood: str, db_manager_instance: Any):
        """
        Broadcasts presence update (online/offline, mood) to relevant users.
        "Relevant users" could be those in active chats with this user.
        """
        # Similar logic to broadcast_user_update_for_profile_change to find relevant users
        user_chats_resp = await db_manager_instance.get_table("chat_participants").select("chat_id").eq("user_id", str(user_id)).execute()
        chat_ids = list(set([str(row["chat_id"]) for row in user_chats_resp.data]))

        if not chat_ids:
            return

        all_participants_to_notify_resp = await db_manager_instance.get_table("chat_participants").select("user_id").in_("chat_id", chat_ids).execute()
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


manager = WebSocketConnectionManager()
