
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt, ExpiredSignatureError
from passlib.context import CryptContext
from app.config import settings
from app.utils.logging import logger
from uuid import UUID

# Re-using pwd_context definition from auth.models for consistency, or define here
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    # 🔒 Security: Add a token_type claim to distinguish access from refresh tokens.
    to_encode.update({"token_type": "access"})
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# 🔒 Security: Create a separate function for refresh tokens with a much longer expiry.
def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    # 🔒 Security: Add a token_type claim to distinguish access from refresh tokens.
    to_encode.update({"token_type": "refresh"})
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# 🔒 Security: New function to create a short-lived token for completing registration after OTP verification.
def create_registration_token(phone: str) -> str:
    """
    Creates a very short-lived JWT that proves a phone number has been verified via OTP.
    This token is required to call the /complete-registration endpoint.
    """
    expires_delta = timedelta(minutes=10) # User has 10 minutes to complete registration
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "sub": phone,
        "exp": expire,
        "token_type": "registration"
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# 🔒 Security: New function to validate the registration token.
def verify_registration_token(token: str) -> Optional[str]:
    """
    Verifies a registration token. If valid, it returns the phone number.
    Otherwise, it returns None.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("token_type") != "registration":
            logger.warning("Attempt to use non-registration token for registration.")
            return None
        phone: Optional[str] = payload.get("sub")
        return phone
    except ExpiredSignatureError:
        logger.warning("Expired registration token used.")
        return None
    except JWTError as e:
        logger.error(f"JWTError while verifying registration token: {e}")
        return None


# Placeholder for image/clip validation - kept from original structure
from fastapi import UploadFile, HTTPException, status

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_CLIP_TYPES = {"audio/mpeg", "audio/wav", "audio/webm", "audio/ogg", "audio/mp4", "video/mp4", "video/quicktime", "video/webm"}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", # .docx
    "text/plain"
}
MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB general limit


def validate_image_upload(file: UploadFile):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid image file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large. Max size is {MAX_FILE_SIZE/1024/1024}MB.")

def validate_clip_upload(file: UploadFile):
    if file.content_type not in ALLOWED_CLIP_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid audio/video file type. Allowed: {', '.join(ALLOWED_CLIP_TYPES)}")
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large. Max size is {MAX_FILE_SIZE/1024/1024}MB.")

def validate_document_upload(file: UploadFile):
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid document file type. Allowed: {', '.join(ALLOWED_DOCUMENT_TYPES)}")
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large. Max size is {MAX_FILE_SIZE/1024/1024}MB.")
