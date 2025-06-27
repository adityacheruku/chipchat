
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import cloudinary
import cloudinary.uploader

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

async def upload_avatar_to_cloudinary(file: UploadFile) -> str:
    validate_image_upload(file) 
    try:
        logger.info(f"Attempting to upload avatar: {file.filename}")
        result = cloudinary.uploader.upload(
            file.file, 
            folder="chirpchat_avatars", 
            resource_type="image",
            overwrite=True, 
            )
        logger.info(f"Avatar {file.filename} uploaded successfully to Cloudinary. URL: {result.get('secure_url')}")
        return result.get("secure_url")
    except Exception as e:
        logger.error(f"Cloudinary avatar upload error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar upload to Cloudinary failed: {str(e)}")


@router.post("/avatar", summary="Upload an avatar image, returns URL (intended for profile update)")
async def route_upload_avatar( 
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    logger.info(f"Route /uploads/avatar called by user {current_user.id} for file {file.filename}")
    file_url = await upload_avatar_to_cloudinary(file)
    return {"file_url": file_url}


@router.post("/mood_clip", summary="Upload an audio/video mood clip, returns URL and type")
async def upload_mood_clip(
    file: UploadFile = File(...),
    clip_type: str = Form(...), 
    current_user: UserPublic = Depends(get_current_active_user), 
):
    logger.info(f"Route /uploads/mood_clip called by user {current_user.id} for file {file.filename}, type: {clip_type}")
    validate_clip_upload(file) 
    
    actual_resource_type = "video" 
    if clip_type == "audio":
        logger.info(f"Uploading audio clip {file.filename} for user {current_user.id}")
    
    try:
        result = cloudinary.uploader.upload(
            file.file, 
            folder=f"chirpchat_mood_clips/user_{current_user.id}", 
            resource_type=actual_resource_type
            )
        logger.info(f"Mood clip {file.filename} (type: {clip_type}) uploaded successfully for user {current_user.id}. URL: {result.get('secure_url')}")
        return {"file_url": result.get("secure_url"), "clip_type": clip_type}
    except Exception as e:
        logger.error(f"Cloudinary mood clip upload error for user {current_user.id}, file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Mood clip upload failed: {str(e)}")

@router.post("/chat_image", summary="Upload an image for chat messages, returns URL")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    logger.info(f"Route /uploads/chat_image called by user {current_user.id} for file {file.filename}")
    validate_image_upload(file)
    # Eager transformation for thumbnails
    eager_transformations = [
      {"width": 200, "height": 200, "crop": "limit"}
    ]
    try:
        result = cloudinary.uploader.upload(
            file.file, 
            folder=f"chirpchat_chat_images/user_{current_user.id}", 
            resource_type="image",
            eager=eager_transformations,
            eager_async=True # Optional: respond faster, let transformations happen in background
            )
        
        # Find the URL of the eagerly transformed thumbnail
        thumbnail_url = None
        if 'eager' in result and len(result['eager']) > 0:
          thumbnail_url = result['eager'][0].get('secure_url')

        logger.info(f"Chat image {file.filename} uploaded for user {current_user.id}. URL: {result.get('secure_url')}, Thumbnail: {thumbnail_url}")
        return {"image_url": result.get("secure_url"), "image_thumbnail_url": thumbnail_url}
    except Exception as e:
        logger.error(f"Cloudinary chat image upload error for user {current_user.id}, file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat image upload failed: {str(e)}")

@router.post("/chat_document", summary="Upload a document for chat messages, returns URL and filename")
async def upload_chat_document(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Route /uploads/chat_document called by user {current_user.id} for file {file.filename}")
    validate_document_upload(file)
    try:
        # Get file size before uploading
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)
        
        # Use resource_type 'raw' for documents, and use the original filename
        result = cloudinary.uploader.upload(
            file.file,
            folder=f"chirpchat_chat_documents/user_{current_user.id}",
            resource_type="raw",
            use_filename=True,
            unique_filename=True # Set to true to avoid overwrites
        )
        logger.info(f"Chat document {file.filename} uploaded successfully for user {current_user.id}. URL: {result.get('secure_url')}")
        return {
            "file_url": result.get("secure_url"), 
            "file_name": file.filename,
            "file_size_bytes": file_size
        }
    except Exception as e:
        logger.error(f"Cloudinary chat document upload error for user {current_user.id}, file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat document upload failed: {str(e)}")


@router.post("/voice_message", summary="Upload a voice message for chat, returns URL and metadata")
async def upload_voice_message(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user),
):
    logger.info(f"Route /uploads/voice_message called by user {current_user.id} for file {file.filename}")
    validate_clip_upload(file)

    try:
        # Cloudinary's "video" resource type handles audio files well and is recommended for universal transformation/playback features
        result = cloudinary.uploader.upload(
            file.file,
            folder=f"chirpchat_voice_messages/user_{current_user.id}",
            resource_type="video" 
        )
        # Detailed logging of the Cloudinary response
        logger.info(f"Cloudinary voice message response for user {current_user.id}: {result}")
        
        duration_seconds = result.get('duration')
        file_size_bytes = result.get('bytes')
        audio_format = result.get('format')

        logger.info(f"Voice message {file.filename} uploaded for user {current_user.id}. URL: {result.get('secure_url')}, Duration: {duration_seconds}s, Size: {file_size_bytes}B, Format: {audio_format}")
        
        return {
            "file_url": result.get("secure_url"), 
            "clip_type": "audio",
            "duration_seconds": round(duration_seconds) if duration_seconds is not None else None,
            "file_size_bytes": file_size_bytes,
            "audio_format": audio_format
        }
    except Exception as e:
        logger.error(f"Cloudinary voice message upload error for user {current_user.id}, file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Voice message upload failed: {str(e)}")
