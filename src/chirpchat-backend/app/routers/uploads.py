
import os
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import cloudinary
import cloudinary.uploader
from typing import Dict, Any, List
from pydantic import BaseModel, ValidationError

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

class UploadPayload(BaseModel):
    file_type: str
    eager: List[str] = []

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
    payload: str = Form(...), # JSON payload as a string
    current_user: UserPublic = Depends(get_current_active_user), 
):
    """
    A unified endpoint to handle all file uploads for the chat.
    It validates the file, uploads it to Cloudinary with appropriate transformations,
    and returns the necessary URLs and metadata.
    """
    try:
        upload_data = UploadPayload.model_validate_json(payload)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Invalid payload format: {e}")

    file_type = upload_data.file_type
    eager_transformations = upload_data.eager

    logger.info(f"Route /uploads/file called by user {current_user.id} for file '{file.filename}' of type '{file_type}'")

    folder = f"kuchlu_chat_media/user_{current_user.id}"
    
    if file_type == 'image':
        validate_image_upload(file)
        resource_type="image"
    elif file_type == 'video':
        validate_clip_upload(file)
        resource_type="video"
    elif file_type == 'document':
        validate_document_upload(file)
        resource_type="raw"
    elif file_type == 'voice_message':
        validate_clip_upload(file)
        resource_type="video" # Stored as video to get duration
    else:
        raise HTTPException(status_code=400, detail="Invalid file_type provided.")

    # This function now returns the full Cloudinary result
    result = await _upload_to_cloudinary(
        file, 
        folder, 
        resource_type=resource_type, 
        transformations=eager_transformations
    )
    
    return result

