
import os
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import cloudinary
import cloudinary.uploader
from typing import Dict, Any, List
from pydantic import BaseModel, ValidationError
import io

from app.auth.dependencies import get_current_active_user 
from app.auth.schemas import UserPublic 
from app.utils.security import validate_image_upload, validate_clip_upload, validate_document_upload
from app.utils.logging import logger 
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen import File as MutagenFile

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

def extract_audio_metadata(content: bytes, filename: str) -> dict:
    """Extracts metadata from an audio file using mutagen."""
    metadata = {}
    file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
    file_like_object = io.BytesIO(content)
    
    try:
        audio = None
        if file_ext == 'mp3':
            audio = MP3(file_like_object)
        elif file_ext == 'flac':
            audio = FLAC(file_like_object)
        elif file_ext in ['m4a', 'mp4', 'm4b']:
            audio = MP4(file_like_object)
        else:
            audio = MutagenFile(file_like_object, easy=True)

        if audio:
            if audio.info:
                metadata['duration'] = int(audio.info.length)
                metadata['bitrate'] = audio.info.bitrate
            if audio.tags:
                tags_dict = dict(audio.tags)
                if 'title' in tags_dict: metadata['title'] = tags_dict['title'][0]
                if 'artist' in tags_dict: metadata['artist'] = tags_dict['artist'][0]
                if 'album' in tags_dict: metadata['album'] = tags_dict['album'][0]
                if 'tracknumber' in tags_dict: metadata['tracknumber'] = tags_dict['tracknumber'][0]
                if 'date' in tags_dict: metadata['date'] = tags_dict['date'][0]

    except Exception as e:
        logger.warning(f"Could not extract metadata from {filename}: {e}")
    
    return metadata

async def _upload_to_cloudinary(file_obj, folder: str, resource_type: str, transformations: list = [], filename: str = "file") -> Dict[str, Any]:
    """Helper function to handle Cloudinary upload and error handling."""
    try:
        logger.info(f"Attempting to upload: {filename} to folder {folder} with transformations: {transformations}")
        result = cloudinary.uploader.upload(
            file_obj, 
            folder=folder, 
            resource_type=resource_type,
            eager=transformations,
            eager_async=True
        )
        logger.info(f"File {filename} uploaded successfully. URL: {result.get('secure_url')}")
        return result
    except Exception as e:
        logger.error(f"Cloudinary upload error for {filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload to Cloudinary failed: {str(e)}")

@router.post("/file", summary="Upload any file for chat messages")
async def upload_generic_file(
    file: UploadFile = File(...),
    payload: str = Form(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    try:
        upload_data = UploadPayload.model_validate_json(payload)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Invalid payload format: {e}")

    file_type = upload_data.file_type
    eager_transformations = upload_data.eager

    logger.info(f"Route /uploads/file called by user {current_user.id} for file '{file.filename}' of type '{file_type}'")

    folder = f"kuchlu_chat_media/user_{current_user.id}"
    resource_type = "auto"
    file_to_upload: Any = file.file
    extracted_metadata = {}

    if file_type == 'image':
        validate_image_upload(file)
        resource_type = "image"
    elif file_type == 'video':
        validate_clip_upload(file)
        resource_type = "video"
    elif file_type == 'document':
        validate_document_upload(file)
        resource_type = "raw"
    elif file_type in ['voice_message', 'audio']:
        validate_clip_upload(file)
        resource_type = "video"
        if file_type == 'audio':
            content = await file.read()
            extracted_metadata = extract_audio_metadata(content, file.filename or "audio_file")
            file_to_upload = io.BytesIO(content) # Use bytes for upload after reading
    else:
        raise HTTPException(status_code=400, detail="Invalid file_type provided.")

    result = await _upload_to_cloudinary(
        file_to_upload, 
        folder, 
        resource_type=resource_type, 
        transformations=eager_transformations,
        filename=file.filename or "uploaded_file"
    )
    
    if extracted_metadata:
        result['file_metadata'] = extracted_metadata

    return result
