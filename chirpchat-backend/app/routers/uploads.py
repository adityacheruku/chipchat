
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
        logger.info(f"Attempting to upload: {file.filename} to folder {folder} with transformations: {transformations}")
        result = cloudinary.uploader.upload(
            file.file, 
            folder=folder, 
            resource_type=resource_type,
            eager=transformations,
            eager_async=True # Use async eager transformations for faster response times
        )
        logger.info(f"File {file.filename} uploaded successfully. URL: {result.get('secure_url')}")
        return result
    except Exception as e:
        logger.error(f"Cloudinary upload error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload to Cloudinary failed: {str(e)}")


@router.post("/file", summary="Upload any file for chat messages")
async def upload_generic_file(
    file: UploadFile = File(...),
    file_type: str = Form(...), # Expected: 'image', 'video', 'document', 'voice_message'
    current_user: UserPublic = Depends(get_current_active_user), 
):
    """
    A unified endpoint to handle all file uploads for the chat.
    It validates the file, uploads it to Cloudinary with appropriate transformations,
    and returns the necessary URLs and metadata.
    """
    logger.info(f"Route /uploads/file called by user {current_user.id} for file '{file.filename}' of type '{file_type}'")

    folder = f"kuchlu_chat_media/user_{current_user.id}"
    response_data = {}
    
    file_size = file.size or 0

    if file_type == 'image':
        validate_image_upload(file)
        transformations = [{"width": 200, "height": 200, "crop": "limit"}]
        result = await _upload_to_cloudinary(file, folder, resource_type="image", transformations=transformations)
        response_data = {
            "image_url": result.get("secure_url"),
            "image_thumbnail_url": result.get('eager', [{}])[0].get('secure_url')
        }

    elif file_type == 'video':
        validate_clip_upload(file)
        # Create a video thumbnail (first frame as a JPG)
        transformations = [{"width": 300, "height": 300, "crop": "limit", "format": "jpg"}]
        result = await _upload_to_cloudinary(file, folder, resource_type="video", transformations=transformations)
        response_data = {
            "file_url": result.get("secure_url"),
            "clip_type": "video",
            "thumbnail_url": result.get('eager', [{}])[0].get('secure_url'),
            "duration_seconds": round(result.get("duration", 0)),
        }

    elif file_type == 'document':
        validate_document_upload(file)
        result = await _upload_to_cloudinary(file, folder, resource_type="raw")
        response_data = {
            "file_url": result.get("secure_url"), 
            "file_name": file.filename,
            "file_size_bytes": file_size,
        }

    elif file_type == 'voice_message':
        validate_clip_upload(file)
        # Voice notes are stored as video resource type in Cloudinary to get duration
        result = await _upload_to_cloudinary(file, folder, resource_type="video")
        response_data = {
            "file_url": result.get("secure_url"), 
            "clip_type": "audio",
            "duration_seconds": round(result.get("duration", 0)),
            "file_size_bytes": result.get('bytes'),
            "audio_format": result.get('format')
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid file_type provided.")

    return response_data
