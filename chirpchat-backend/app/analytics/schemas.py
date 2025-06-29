
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class FileAnalyticsCreate(BaseModel):
    message_id: UUID
    upload_duration_seconds: float
    file_size_bytes: int
    compressed_size_bytes: Optional[int] = None
    network_quality: str
    file_type: str

