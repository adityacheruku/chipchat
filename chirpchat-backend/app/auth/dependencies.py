
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from uuid import UUID

from app.config import settings
from app.auth.schemas import TokenData, UserPublic # UserPublic might be too much here, UserInDB would be from models
from app.database import db_manager
# from app.auth.models import UserInDB # If UserInDB becomes a standard internal model

# Define OAuth2PasswordBearer for token URL
# The tokenUrl should match your login endpoint path
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserPublic: # Returning UserPublic for now for simplicity
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub") # Assuming 'sub' holds the email
        user_id_str: Optional[str] = payload.get("user_id")

        if email is None and user_id_str is None:
            raise credentials_exception
        
        token_data = TokenData(email=email, user_id=UUID(user_id_str) if user_id_str else None)

    except (JWTError, ValidationError) as e:
        print(f"JWT Error: {e}") # For debugging
        raise credentials_exception
    
    user = None
    if token_data.user_id:
        response = await db_manager.get_table("users").select("*").eq("id", str(token_data.user_id)).maybe_single().execute()
        user = response.data
    elif token_data.email: # Fallback if user_id not in token, though user_id is preferred
        response = await db_manager.get_table("users").select("*").eq("email", token_data.email).maybe_single().execute()
        user = response.data

    if user is None:
        raise credentials_exception
    
    # Convert Supabase dict to UserPublic Pydantic model
    # Ensure field names match between Supabase table and UserPublic model
    # Example: Supabase 'display_name' maps to UserPublic 'display_name'
    user_public_data = {
        "id": user.get("id"),
        "email": user.get("email"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
        "mood": user.get("mood"),
        "phone": user.get("phone"),
        "is_online": user.get("is_online"),
        "last_seen": user.get("last_seen"),
    }
    return UserPublic(**user_public_data)

async def get_current_active_user(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    # Placeholder if we need to check for active status, though UserPublic doesn't have is_active
    # For now, get_current_user is sufficient for "logged in" status
    # if not current_user.is_active: # Requires is_active in UserPublic or a different model
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
