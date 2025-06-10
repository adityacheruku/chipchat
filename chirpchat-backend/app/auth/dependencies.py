
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError, EmailStr
from uuid import UUID
from typing import Optional

from app.config import settings
from app.auth.schemas import TokenData, UserPublic 
from app.database import db_manager

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
            raise credentials_exception
        
        token_data = TokenData(phone=phone, user_id=UUID(user_id_str) if user_id_str else None)

    except (JWTError, ValidationError) as e:
        print(f"JWT Error: {e}") 
        raise credentials_exception
    
    user_dict = None # Changed from 'user' to 'user_dict' to avoid Pydantic model name clash
    if token_data.user_id:
        response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
        user_dict = response.data
    elif token_data.phone: 
        response = await db_manager.get_table("users").select("*").eq("phone", token_data.phone).maybe_single().execute()
        user_dict = response.data

    if user_dict is None:
        raise credentials_exception
    
    user_public_data = {
        "id": user_dict.get("id"),
        "display_name": user_dict.get("display_name"),
        "avatar_url": user_dict.get("avatar_url"),
        "mood": user_dict.get("mood"),
        "phone": user_dict.get("phone"),
        "email": user_dict.get("email"), # Optional email
        "is_online": user_dict.get("is_online"),
        "last_seen": user_dict.get("last_seen"),
    }
    return UserPublic(**user_public_data)

async def get_current_active_user(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    # Placeholder for active status check if UserPublic model had 'is_active'
    # user_in_db_resp = await db_manager.get_table("users").select("is_active").eq("id", str(current_user.id)).single().execute()
    # if not user_in_db_resp.data or not user_in_db_resp.data.get("is_active"):
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

