
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError, JWTClaimsError
from pydantic import ValidationError, EmailStr
from uuid import UUID
from typing import Optional

from app.config import settings
from app.auth.schemas import TokenData, UserPublic 
from app.database import db_manager
from app.utils.logging import logger # Ensure logger is imported

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login") # Matches your login endpoint path

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserPublic:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        phone: Optional[str] = payload.get("sub") # 'sub' now holds the phone number
        user_id_str: Optional[str] = payload.get("user_id")

        if phone is None and user_id_str is None:
            logger.warning("Token missing both phone (sub) and user_id.")
            raise credentials_exception
        
        # Pydantic validation for token data structure
        token_data = TokenData(phone=phone, user_id=UUID(user_id_str) if user_id_str else None)
        logger.info(f"Token decoded successfully for user_id: {token_data.user_id}, phone: {token_data.phone}")

    except ExpiredSignatureError:
        logger.warning("Token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTClaimsError:
        logger.warning("Token claims are invalid.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.warning(f"JWT Error: {str(e)}") 
        raise credentials_exception
    except ValidationError as e:
        logger.warning(f"Pydantic ValidationError for TokenData: {str(e)}")
        raise credentials_exception
    
    user_dict = None 
    if token_data.user_id:
        logger.info(f"Attempting to fetch user by ID: {token_data.user_id}")
        response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
        user_dict = response.data
    elif token_data.phone: 
        logger.info(f"Attempting to fetch user by phone: {token_data.phone}")
        response = await db_manager.get_table("users").select("*").eq("phone", token_data.phone).maybe_single().execute()
        user_dict = response.data

    if user_dict is None:
        logger.warning(f"User not found in DB for token_data: user_id='{token_data.user_id}', phone='{token_data.phone}'")
        raise credentials_exception
    
    try:
        # Pydantic will ignore extra fields from DB, so we can pass user_dict directly
        user_for_return = UserPublic(**user_dict)
        logger.info(f"Successfully authenticated user: {user_for_return.id} ({user_for_return.display_name})")
        return user_for_return
    except ValidationError as e:
        logger.error(f"Pydantic ValidationError when creating UserPublic from DB data for user ID '{user_dict.get('id')}': {str(e)}")
        # This indicates a mismatch between DB data and UserPublic schema
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing user data.",
        )


async def get_current_active_user(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    # This is where you might check if a user account is active (e.g., not banned or soft-deleted)
    # For now, it just returns the current_user if get_current_user succeeds.
    return current_user
