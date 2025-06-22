from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError, EmailStr
from uuid import UUID
from typing import Optional

from app.config import settings
from app.auth.schemas import TokenData, UserPublic 
from app.database import db_manager
from app.utils.logging import logger # Ensure logger is imported

# Set auto_error to False. This means if the token is not found in the header,
# it won't immediately raise an error, allowing our custom dependency to check the query params.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

async def get_token_from_header_or_query(
    token_from_header: Optional[str] = Depends(oauth2_scheme),
    token_from_query: Optional[str] = Query(None, alias="token")
) -> str:
    """
    Dependency that extracts a JWT token from either the Authorization header or a 'token' query parameter.
    This is necessary to support authentication for protocols like Server-Sent Events (SSE)
    where setting custom headers is not possible in the browser.
    """
    if token_from_header:
        return token_from_header
    if token_from_query:
        return token_from_query
    # If neither token is present, raise the 401 error.
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated: No token provided in header or query parameter.",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def try_get_user_from_token(token: Optional[str]) -> Optional[UserPublic]:
    """
    Safely decodes a JWT and fetches the user from the database.
    Returns the UserPublic object on success, or None on any failure (e.g., invalid token, user not found).
    This function does NOT raise HTTPExceptions, making it suitable for WebSocket/SSE authentication checks.
    """
    if not token:
        logger.warning("Auth: Token not provided.")
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        phone: Optional[str] = payload.get("sub")
        user_id_str: Optional[str] = payload.get("user_id")

        if phone is None and user_id_str is None:
            logger.warning("Auth: Token missing both phone (sub) and user_id.")
            return None
        
        token_data = TokenData(phone=phone, user_id=UUID(user_id_str) if user_id_str else None)
        logger.info(f"Auth: Token decoded for user_id='{token_data.user_id}', phone='{token_data.phone}'")

    except ExpiredSignatureError:
        logger.warning("Auth: Token has expired.")
        return None
    except (JWTError, ValidationError) as e:
        logger.warning(f"Auth: Token validation error: {e}")
        return None
    except Exception as e:
        logger.error(f"Auth: Unexpected error during token decoding: {e}", exc_info=True)
        return None
    
    user_dict = None
    try:
        if token_data.user_id:
            response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
            user_dict = response.data
        elif token_data.phone: 
            response = await db_manager.get_table("users").select("*").eq("phone", token_data.phone).maybe_single().execute()
            user_dict = response.data

    except Exception as e:
        logger.error(f"Auth: Database error fetching user: {e}", exc_info=True)
        return None
    
    if user_dict is None:
        logger.warning(f"Auth: User not found in DB for token: {token_data}")
        return None
    
    try:
        return UserPublic(**user_dict)
    except ValidationError as e:
        logger.error(f"Auth: Pydantic validation error for UserPublic: {e}")
        return None

async def get_current_user(token: str = Depends(get_token_from_header_or_query)) -> UserPublic:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = await try_get_user_from_token(token)
    if not user:
        raise credentials_exception
    
    logger.info(f"Successfully authenticated user: {user.id} ({user.display_name})")
    return user


async def get_current_active_user(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    # This is where you might check if a user account is active (e.g., not banned or soft-deleted)
    # For now, it just returns the current_user if get_current_user succeeds.
    return current_user
