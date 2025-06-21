
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID

from app.auth.dependencies import get_current_active_user
from app.auth.schemas import UserPublic
from app.database import db_manager
from app.utils.logging import logger
from app.stickers.schemas import (
    StickerPackResponse, 
    StickerListResponse, 
    StickerSearchBody
)

router = APIRouter(prefix="/stickers", tags=["Stickers"])

@router.get("/packs", response_model=StickerPackResponse)
async def get_sticker_packs(
    current_user: UserPublic = Depends(get_current_active_user)
):
    """
    Retrieve all active sticker packs available.
    In the future, this can be customized to return packs specific to the user.
    """
    logger.info(f"User {current_user.id} requesting sticker packs.")
    try:
        packs_resp = await db_manager.get_table("sticker_packs").select("*").eq("is_active", True).execute()
        if not packs_resp or not packs_resp.data:
            return StickerPackResponse(packs=[])
        
        return StickerPackResponse(packs=packs_resp.data)
    except Exception as e:
        logger.error(f"Error fetching sticker packs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve sticker packs.")

@router.get("/pack/{pack_id}", response_model=StickerListResponse)
async def get_stickers_in_pack(
    pack_id: UUID,
    current_user: UserPublic = Depends(get_current_active_user)
):
    """
    Get all stickers within a specific pack, ordered by their `order_index`.
    """
    logger.info(f"User {current_user.id} requesting stickers for pack {pack_id}.")
    try:
        stickers_resp = await db_manager.get_table("stickers").select("*").eq("pack_id", str(pack_id)).order("order_index", desc=False).execute()
        
        if not stickers_resp or not stickers_resp.data:
            return StickerListResponse(stickers=[])
            
        return StickerListResponse(stickers=stickers_resp.data)
    except Exception as e:
        logger.error(f"Error fetching stickers for pack {pack_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve stickers for the specified pack.")

@router.post("/search", response_model=StickerListResponse)
async def search_stickers(
    search_body: StickerSearchBody,
    current_user: UserPublic = Depends(get_current_active_user)
):
    """
    Search for stickers by a keyword.
    The search query is matched against sticker names and tags.
    """
    query = search_body.query.strip()
    logger.info(f"User {current_user.id} searching for stickers with query: '{query}'")
    if not query:
        return StickerListResponse(stickers=[])

    try:
        # Using PostgREST 'or' filter to search in name or tags.
        # Searches for query as a substring in 'name' (case-insensitive)
        # OR if the 'tags' array contains the query term.
        search_filter = f"or(name.ilike.%{query}%,tags.cs.{{{query}}})"
        search_resp = await db_manager.get_table("stickers").select("*").filter("and", search_filter).limit(50).execute()
        
        if not search_resp or not search_resp.data:
            return StickerListResponse(stickers=[])
        
        return StickerListResponse(stickers=search_resp.data)
    except Exception as e:
        logger.error(f"Error searching stickers with query '{query}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while searching for stickers.")

