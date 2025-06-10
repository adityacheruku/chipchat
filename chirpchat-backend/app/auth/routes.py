
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm # For standard token endpoint
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta

from app.auth.schemas import UserCreate, UserLogin, UserUpdate, UserPublic, Token
from app.auth.dependencies import get_current_user, get_current_active_user
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.database import db_manager
from app.config import settings # For token expiration
from app.utils.email_utils import send_login_notification_email # Import email utility
from app.utils.logging import logger # For logging


auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])

@auth_router.post("/register", response_model=Token)
async def register(user_create: UserCreate):
    existing_user_response = await db_manager.get_table("users").select("id").eq("email", user_create.email).maybe_single().execute()
    if existing_user_response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_password = get_password_hash(user_create.password)
    user_id = uuid4()
    
    new_user_data = {
        "id": str(user_id),
        "email": user_create.email,
        "hashed_password": hashed_password,
        "display_name": user_create.display_name,
        "avatar_url": f"https://placehold.co/100x100.png?text={user_create.display_name[:1].upper()}", # Default avatar
        "mood": user_create.initial_mood if hasattr(user_create, 'initial_mood') and user_create.initial_mood else "Neutral",
        "phone": user_create.phone if hasattr(user_create, 'phone') else None,
        "is_active": True,
        "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    insert_response = await db_manager.get_table("users").insert(new_user_data).execute()
    if not insert_response.data or len(insert_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user",
        )
    
    created_user_raw = insert_response.data[0]
    
    user_public_info = UserPublic(
        id=created_user_raw["id"],
        display_name=created_user_raw["display_name"],
        avatar_url=created_user_raw["avatar_url"],
        mood=created_user_raw["mood"],
        phone=created_user_raw.get("phone"),
        is_online=created_user_raw["is_online"],
        last_seen=created_user_raw.get("last_seen")
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": created_user_raw["email"], "user_id": str(created_user_raw["id"])}, 
        expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@auth_router.post("/login", response_model=Token) # Changed from /token to /login for clarity with frontend
async def login(
    request: Request, # To get client IP for email notification
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends() # Use standard form data for username/password
):
    # Using form_data.username as email, as per UserLogin schema
    user_response = await db_manager.get_table("users").select("*").eq("email", form_data.username).maybe_single().execute()
    
    if not user_response.data:
        logger.warning(f"Login attempt failed for email: {form_data.username} - User not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_in_db = user_response.data
    
    if not verify_password(form_data.password, user_in_db["hashed_password"]):
        logger.warning(f"Login attempt failed for email: {form_data.username} - Incorrect password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_public_info = UserPublic(
        id=user_in_db["id"],
        display_name=user_in_db["display_name"],
        avatar_url=user_in_db["avatar_url"],
        mood=user_in_db["mood"],
        phone=user_in_db.get("phone"),
        is_online=user_in_db["is_online"],
        last_seen=user_in_db.get("last_seen")
    )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_in_db["email"], "user_id": str(user_in_db["id"])},
        expires_delta=access_token_expires
    )
    
    # Send login notification email
    if settings.NOTIFICATION_EMAIL_TO:
        login_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        client_host = request.client.host if request.client else "Unknown IP"
        background_tasks.add_task(
            send_login_notification_email,
            logged_in_user_name=user_in_db["display_name"],
            logged_in_user_phone=user_in_db.get("phone"),
            login_time=login_time_utc,
            client_host=client_host
        )
        logger.info(f"Login notification task added for user: {user_in_db['display_name']}")
    else:
        logger.info("NOTIFICATION_EMAIL_TO not set. Skipping login notification email for user: {user_in_db['display_name']}")


    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@user_router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserPublic = Depends(get_current_active_user)):
    return current_user

@user_router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: UUID, current_user_dep: UserPublic = Depends(get_current_user)):
    # current_user_dep is just to ensure the endpoint is protected
    # Select only public fields
    user_response = await db_manager.get_table("users").select(
        "id, display_name, avatar_url, mood, phone, is_online, last_seen"
    ).eq("id", str(user_id)).maybe_single().execute()
    
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**user_response.data)

@user_router.put("/me/profile", response_model=UserPublic)
async def update_profile(
    profile_update: UserUpdate, 
    current_user: UserPublic = Depends(get_current_active_user)
):
    update_data = profile_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # If password is being updated, hash it
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data: # Handle empty password string if sent
        del update_data["password"]


    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data or len(updated_user_response.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")

    # Fetch the full updated user to return (Supabase update returns the updated row(s))
    refreshed_user_data = updated_user_response.data[0]
    
    # If mood changed, broadcast presence update
    if "mood" in update_data and "mood" in refreshed_user_data:
        from app.websocket.manager import manager # Local import to avoid circular dependency
        await manager.broadcast_user_update_for_profile_change(
            user_id=current_user.id,
            updated_data={"mood": refreshed_user_data["mood"]},
            db_manager_instance=db_manager # Pass db_manager instance
        )

    return UserPublic(
        id=refreshed_user_data["id"],
        display_name=refreshed_user_data["display_name"],
        avatar_url=refreshed_user_data["avatar_url"],
        mood=refreshed_user_data["mood"],
        phone=refreshed_user_data.get("phone"),
        is_online=refreshed_user_data["is_online"],
        last_seen=refreshed_user_data.get("last_seen")
    )


@user_router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar_route( # Renamed to avoid potential conflict with helper name
    file: UploadFile = File(...), 
    current_user: UserPublic = Depends(get_current_active_user)
):
    from app.routers.uploads import upload_avatar_to_cloudinary # Helper function
    
    try:
        file_url = await upload_avatar_to_cloudinary(file) 
    except HTTPException as e:
        raise e 
    except Exception as e:
        logger.error(f"Avatar upload processing failed for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Avatar upload processing failed.")

    update_data = {
        "avatar_url": file_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data or len(updated_user_response.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or avatar update failed")
    
    refreshed_user_data = updated_user_response.data[0]
    return UserPublic(
         id=refreshed_user_data["id"],
        display_name=refreshed_user_data["display_name"],
        avatar_url=refreshed_user_data["avatar_url"],
        mood=refreshed_user_data["mood"],
        phone=refreshed_user_data.get("phone"),
        is_online=refreshed_user_data["is_online"],
        last_seen=refreshed_user_data.get("last_seen")
    )
