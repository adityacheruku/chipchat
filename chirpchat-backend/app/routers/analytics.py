
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_active_user
from app.auth.schemas import UserPublic
from app.database import db_manager
from app.utils.logging import logger
from app.analytics.schemas import FileAnalyticsCreate
from datetime import datetime, timezone

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.post("/file", status_code=status.HTTP_201_CREATED)
async def track_file_analytics(
    payload: FileAnalyticsCreate,
    current_user: UserPublic = Depends(get_current_active_user)
):
    """
    Receives and stores file upload analytics from the client.
    This is a fire-and-forget endpoint from the client's perspective.
    """
    logger.info(f"Received file analytics for message {payload.message_id} from user {current_user.id}")
    
    analytics_data = {
        "user_id": str(current_user.id),
        "message_id": str(payload.message_id),
        "upload_duration_seconds": payload.upload_duration_seconds,
        "file_size_bytes": payload.file_size_bytes,
        "compressed_size_bytes": payload.compressed_size_bytes,
        "network_quality": payload.network_quality,
        "file_type": payload.file_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    try:
        await db_manager.admin_client.table("file_analytics").insert(analytics_data).execute()
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Could not store file analytics: {e}", exc_info=True)
        # We don't raise an HTTPException because the client doesn't need to know about this failure.
        # This is a background tracking task.
        return {"status": "error"}

