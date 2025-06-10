
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import cloudinary
import cloudinary.uploader

from app.auth.dependencies import get_current_active_user # Use active user
from app.auth.schemas import UserPublic # For typing current_user
from app.utils.security import validate_image_upload, validate_clip_upload # For basic validation

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True # Ensure secure_url is default
)

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# This helper can be called by POST /users/me/avatar
async def upload_avatar_to_cloudinary(file: UploadFile) -> str:
    validate_image_upload(file) # Basic validation
    try:
        # Use a unique public_id to prevent overwrites, or let Cloudinary manage
        # Adding user_id to folder path can also help organize
        result = cloudinary.uploader.upload(
            file.file, 
            folder="chirpchat_avatars", 
            resource_type="image",
            overwrite=True, # Consider if overwriting is desired or use unique public_ids
            # public_id=f"user_{current_user.id}_avatar" # Example for unique public_id
            )
        return result.get("secure_url")
    except Exception as e:
        # Log the detailed error from Cloudinary if possible
        print(f"Cloudinary upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Avatar upload to Cloudinary failed: {str(e)}")


@router.post("/avatar", summary="Upload an avatar image, returns URL (intended for profile update)")
async def route_upload_avatar( # Renamed to avoid conflict with helper
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), # Secure endpoint
):
    # This endpoint is if frontend wants to upload first, then update profile with URL.
    # The POST /users/me/avatar directly handles upload and DB update.
    # This one just returns the URL.
    file_url = await upload_avatar_to_cloudinary(file)
    return {"file_url": file_url}


@router.post("/mood_clip", summary="Upload an audio/video mood clip, returns URL and type")
async def upload_mood_clip(
    file: UploadFile = File(...),
    clip_type: str = Form(...), # "audio" or "video"
    current_user: UserPublic = Depends(get_current_active_user), # Secure endpoint
):
    validate_clip_upload(file) # Basic validation
    
    # Cloudinary uses "video" resource_type for both audio and video.
    # Specific format/transformations can be applied if needed.
    actual_resource_type = "video" 
    
    try:
        result = cloudinary.uploader.upload(
            file.file, 
            folder=f"chirpchat_mood_clips/user_{current_user.id}", 
            resource_type=actual_resource_type
            )
        return {"file_url": result.get("secure_url"), "clip_type": clip_type}
    except Exception as e:
        print(f"Cloudinary mood clip upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Mood clip upload failed: {str(e)}")

@router.post("/chat_image", summary="Upload an image for chat messages, returns URL")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user), # Secure endpoint
):
    validate_image_upload(file) # Basic validation
    try:
        result = cloudinary.uploader.upload(
            file.file, 
            folder=f"chirpchat_chat_images/user_{current_user.id}", 
            resource_type="image"
            )
        return {"image_url": result.get("secure_url")}
    except Exception as e:
        print(f"Cloudinary chat image upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat image upload failed: {str(e)}")
