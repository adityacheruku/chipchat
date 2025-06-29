
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import cloudinary
import cloudinary.uploader
from typing import Dict, Any

from app.auth.dependencies import get_current_active_user 
from app.auth.schemas import UserPublic 
from app.utils.security import validate_image_upload, validate_clip_upload, validate_document_upload
from app.utils.logging import logger 

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True 
)

router = APIRouter(prefix="/uploads", tags=["Uploads"])

async def _upload_to_cloudinary(file: UploadFile, folder: str, resource_type: str, transformations: list = []) -> Dict[str, Any]:
    """Helper function to handle Cloudinary upload and error handling."""
    try:
        logger.info(f"Attempting to upload: {file.filename} to folder {folder}")
        result = cloudinary.uploader.upload(
            file.file, 
            folder=folder, 
            resource_type=resource_type,
            eager=transformations,
            eager_async=bool(transformations)
        )
        logger.info(f"File {file.filename} uploaded successfully. URL: {result.get('secure_url')}")
        return result
    except Exception as e:
        logger.error(f"Cloudinary upload error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload to Cloudinary failed: {str(e)}")


@router.post("/avatar", summary="Upload an avatar image, returns URL (intended for profile update)")
async def route_upload_avatar( 
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    logger.info(f"Route /uploads/avatar called by user {current_user.id} for file {file.filename}")
    validate_image_upload(file) 
    result = await _upload_to_cloudinary(file, folder="kuchlu_avatars", resource_type="image")
    return {"file_url": result.get("secure_url")}


@router.post("/chat_image", summary="Upload an image for chat messages, returns URL and thumbnail")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    logger.info(f"Route /uploads/chat_image called by user {current_user.id} for file {file.filename}")
    validate_image_upload(file)
    transformations = [{"width": 200, "height": 200, "crop": "limit"}]
    result = await _upload_to_cloudinary(file, folder=f"kuchlu_chat_media/user_{current_user.id}", resource_type="image", transformations=transformations)
    
    thumbnail_url = result.get('eager', [{}])[0].get('secure_url')
    return {"image_url": result.get("secure_url"), "image_thumbnail_url": thumbnail_url}

@router.post("/chat_video", summary="Upload a video for chat messages, returns URL and metadata")
async def upload_chat_video(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Route /uploads/chat_video called by user {current_user.id} for file {file.filename}")
    validate_clip_upload(file)
    transformations = [{"width": 300, "height": 300, "crop": "limit", "format": "jpg"}]
    result = await _upload_to_cloudinary(file, folder=f"kuchlu_chat_media/user_{current_user.id}", resource_type="video", transformations=transformations)

    thumbnail_url = result.get('eager', [{}])[0].get('secure_url')
    return {
        "file_url": result.get("secure_url"),
        "clip_type": "video",
        "thumbnail_url": thumbnail_url,
        "duration_seconds": round(result.get("duration", 0)),
    }

@router.post("/chat_document", summary="Upload a document for chat messages, returns URL and filename")
async def upload_chat_document(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Route /uploads/chat_document called by user {current_user.id} for file {file.filename}")
    validate_document_upload(file)
    
    file_size = 0
    if file.size:
        file_size = file.size
    
    result = await _upload_to_cloudinary(file, folder=f"kuchlu_chat_media/user_{current_user.id}", resource_type="raw")
    return {
        "file_url": result.get("secure_url"), 
        "file_name": file.filename,
        "file_size_bytes": file_size,
    }

@router.post("/voice_message", summary="Upload a voice message for chat, returns URL and metadata")
async def upload_voice_message(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Route /uploads/voice_message called by user {current_user.id} for file {file.filename}")
    validate_clip_upload(file)
    result = await _upload_to_cloudinary(file, folder=f"kuchlu_chat_media/user_{current_user.id}", resource_type="video")
        
    return {
        "file_url": result.get("secure_url"), 
        "clip_type": "audio",
        "duration_seconds": round(result.get("duration", 0)),
        "file_size_bytes": result.get('bytes'),
        "audio_format": result.get('format')
    }
