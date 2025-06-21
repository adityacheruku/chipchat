
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class StickerPack(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Sticker(BaseModel):
    id: UUID
    pack_id: UUID
    name: Optional[str] = None
    image_url: str
    tags: Optional[List[str]] = None
    order_index: Optional[int] = 0

    class Config:
        from_attributes = True

class StickerPackResponse(BaseModel):
    packs: List[StickerPack]

class StickerListResponse(BaseModel):
    stickers: List[Sticker]

class StickerSearchBody(BaseModel):
    query: str
