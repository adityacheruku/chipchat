
import os
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Body, BackgroundTasks
import cloudinary
import cloudinary.uploader
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, ValidationError
import io
from pathlib import Path
import aiofiles
from datetime import timedelta
import uuid

from app.auth.dependencies import get_current_active_user 
from app.auth.schemas import UserPublic 
from app.utils.security import validate_image_upload, validate_clip_upload, validate_document_upload
from app.utils.logging import logger 
from app.redis_client import get_redis_client
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

TEMP_UPLOAD_DIR = Path("/tmp/chirpchat_uploads")
TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class UploadPayload(BaseModel):
    file_type: str
    eager: List[str] = []

class InitiateUploadRequest(BaseModel):
    filename: str
    filesize: int
    filetype: str

class InitiateUploadResponse(BaseModel):
    upload_id: str

class FinalizeUploadRequest(BaseModel):
    upload_id: str

def extract_audio_metadata(content: bytes, filename: str) -> dict:
    """Extracts metadata from an audio file using mutagen."""
    metadata = {}
    file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
    file_like_object = io.BytesIO(content)
    
    try:
        audio = None
        if file_ext == 'mp3': audio = MP3(file_like_object)
        elif file_ext == 'flac': audio = FLAC(file_like_object)
        elif file_ext in ['m4a', 'mp4', 'm4b']: audio = MP4(file_like_object)
        else: audio = MutagenFile(file_like_object, easy=True)

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
            file_obj, folder=folder, resource_type=resource_type,
            eager=transformations, eager_async=True
        )
        logger.info(f"File {filename} uploaded successfully. URL: {result.get('secure_url')}")
        return result
    except Exception as e:
        logger.error(f"Cloudinary upload error for {filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload to Cloudinary failed: {str(e)}")

@router.post("/file", summary="Upload any file for chat messages")
async def upload_generic_file(
    file: UploadFile = File(...), payload: str = Form(...),
    current_user: UserPublic = Depends(get_current_active_user), 
):
    try: upload_data = UploadPayload.model_validate_json(payload)
    except ValidationError as e: raise HTTPException(status_code=422, detail=f"Invalid payload format: {e}")
    file_type, eager_transformations = upload_data.file_type, upload_data.eager
    logger.info(f"Route /uploads/file called by user {current_user.id} for file '{file.filename}' of type '{file_type}'")
    folder, resource_type = f"kuchlu_chat_media/user_{current_user.id}", "auto"
    file_to_upload: Any, extracted_metadata = file.file, {}

    if file_type == 'image': validate_image_upload(file); resource_type = "image"
    elif file_type == 'video': validate_clip_upload(file); resource_type = "video"
    elif file_type == 'document': validate_document_upload(file); resource_type = "raw"
    elif file_type in ['voice_message', 'audio']:
        validate_clip_upload(file); resource_type = "video"
        if file_type == 'audio':
            content = await file.read(); extracted_metadata = extract_audio_metadata(content, file.filename or "audio_file")
            file_to_upload = io.BytesIO(content)
    else: raise HTTPException(status_code=400, detail="Invalid file_type provided.")
    result = await _upload_to_cloudinary(file_to_upload, folder, resource_type=resource_type, transformations=eager_transformations, filename=file.filename or "uploaded_file")
    if extracted_metadata: result['file_metadata'] = extracted_metadata
    return result

@router.post("/initiate_chunked", response_model=InitiateUploadResponse)
async def initiate_chunked_upload(request: InitiateUploadRequest, current_user: UserPublic = Depends(get_current_active_user)):
    upload_id = str(uuid.uuid4())
    upload_dir = TEMP_UPLOAD_DIR / upload_id
    upload_dir.mkdir(exist_ok=True)
    redis = await get_redis_client()
    await redis.hset(f"upload:{upload_id}", mapping={
        "filename": request.filename, "filesize": request.filesize, "filetype": request.filetype,
        "status": "initiated", "user_id": str(current_user.id)
    })
    await redis.expire(f"upload:{upload_id}", timedelta(hours=24))
    logger.info(f"Initiated chunked upload {upload_id} for user {current_user.id}")
    return InitiateUploadResponse(upload_id=upload_id)

@router.post("/chunk")
async def upload_chunk_file(
    upload_id: str = Form(...), chunk_index: int = Form(...), chunk: UploadFile = File(...),
    current_user: UserPublic = Depends(get_current_active_user)
):
    upload_dir = TEMP_UPLOAD_DIR / upload_id
    if not upload_dir.exists(): raise HTTPException(status_code=404, detail="Upload session not found or expired.")
    redis = await get_redis_client()
    metadata = await redis.hgetall(f"upload:{upload_id}")
    if not metadata or metadata.get("user_id") != str(current_user.id): raise HTTPException(status_code=403, detail="Permission denied.")
    
    chunk_path = upload_dir / str(chunk_index)
    async with aiofiles.open(chunk_path, 'wb') as f:
        content = await chunk.read()
        await f.write(content)
    
    await redis.sadd(f"upload:{upload_id}:chunks", str(chunk_index))
    logger.debug(f"Received chunk {chunk_index} for upload {upload_id}")
    return {"status": "chunk received", "chunk_index": chunk_index}

@router.post("/finalize_chunked")
async def finalize_chunked_upload(
    request: FinalizeUploadRequest, background_tasks: BackgroundTasks,
    current_user: UserPublic = Depends(get_current_active_user)
):
    upload_id = request.upload_id
    upload_dir = TEMP_UPLOAD_DIR / upload_id
    redis = await get_redis_client()
    metadata = await redis.hgetall(f"upload:{upload_id}")
    if not metadata or not upload_dir.exists() or metadata.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=404, detail="Upload session not found or invalid.")
    
    async def process_and_cleanup_upload(upload_id: str):
        logger.info(f"Finalizing upload for {upload_id}")
        upload_dir, metadata = TEMP_UPLOAD_DIR / upload_id, await redis.hgetall(f"upload:{upload_id}")
        filename, file_type = metadata.get('filename'), metadata.get('filetype', 'raw')
        chunk_indices = sorted([int(c) for c in await redis.smembers(f"upload:{upload_id}:chunks")])
        final_file_path = upload_dir / filename
        
        try:
            async with aiofiles.open(final_file_path, 'wb') as final_file:
                for i in chunk_indices:
                    chunk_path = upload_dir / str(i)
                    async with aiofiles.open(chunk_path, 'rb') as chunk_file: await final_file.write(await chunk_file.read())
            
            resource_type = "auto"
            if "image" in file_type: resource_type = "image"
            elif "video" in file_type: resource_type = "video"
            
            logger.info(f"Assembled file {final_file_path}, uploading to Cloudinary...")
            # Use eager transformations as needed based on file_type, similar to the non-chunked endpoint
            result = await _upload_to_cloudinary(str(final_file_path), f"kuchlu_chat_media/user_{current_user.id}", resource_type, filename=filename)
            logger.info(f"Upload {upload_id} finalized and sent to Cloudinary. URL: {result.get('secure_url')}")
            # TODO: Notify user via WebSocket about the completed upload with the result.
        except Exception as e:
            logger.error(f"Error during finalization of {upload_id}: {e}", exc_info=True)
            # TODO: Notify user via WebSocket about the failure.
        finally:
            for i in chunk_indices:
                (upload_dir / str(i)).unlink(missing_ok=True)
            final_file_path.unlink(missing_ok=True)
            upload_dir.rmdir()
            await redis.delete(f"upload:{upload_id}", f"upload:{upload_id}:chunks")

    background_tasks.add_task(process_and_cleanup_upload, upload_id)
    return {"status": "finalization_started", "upload_id": upload_id}

    