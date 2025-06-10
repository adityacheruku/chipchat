
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from uuid import UUID, uuid4
from datetime import datetime, timezone

from app.auth.schemas import UserCreate, UserLogin, UserUpdate, UserPublic, Token
from app.auth.dependencies import get_current_user, get_current_active_user
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.database import db_manager
# from app.auth.models import UserInDB # Conceptual internal model

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
        "mood": "Neutral",
        "is_active": True,
        "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    insert_response = await db_manager.get_table("users").insert(new_user_data).execute()
    if not insert_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user",
        )
    
    created_user_raw = insert_response.data[0]
    
    # Prepare UserPublic part for the token response
    user_public_info = UserPublic(
        id=created_user_raw["id"],
        email=created_user_raw["email"],
        display_name=created_user_raw["display_name"],
        avatar_url=created_user_raw["avatar_url"],
        mood=created_user_raw["mood"],
        is_online=created_user_raw["is_online"],
        last_seen=created_user_raw.get("last_seen")
    )

    access_token = create_access_token(data={"sub": user_create.email, "user_id": str(user_id)})
    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@auth_router.post("/login", response_model=Token)
async def login(form_data: UserLogin):
    user_response = await db_manager.get_table("users").select("*").eq("email", form_data.email).maybe_single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    user_in_db = user_response.data
    
    if not verify_password(form_data.password, user_in_db["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    user_public_info = UserPublic(
        id=user_in_db["id"],
        email=user_in_db["email"],
        display_name=user_in_db["display_name"],
        avatar_url=user_in_db["avatar_url"],
        mood=user_in_db["mood"],
        is_online=user_in_db["is_online"], # Ideally, this should be updated by WebSocket connection
        last_seen=user_in_db.get("last_seen")
    )
    
    access_token = create_access_token(data={"sub": user_in_db["email"], "user_id": str(user_in_db["id"])})
    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@user_router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserPublic = Depends(get_current_active_user)):
    # get_current_active_user already fetches and validates the user
    return current_user

@user_router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: UUID, current_user_dep: UserPublic = Depends(get_current_user)):
    # current_user_dep is just to ensure the endpoint is protected
    user_response = await db_manager.get_table("users").select("id, email, display_name, avatar_url, mood, is_online, last_seen").eq("id", str(user_id)).maybe_single().execute()
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

    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")

    # Fetch the full updated user to return
    refreshed_user_response = await db_manager.get_table("users").select("*").eq("id", str(current_user.id)).single().execute()
    
    # If mood changed, broadcast presence update (logic to be added in WebSocket manager)
    if "mood" in update_data:
        from app.websocket.manager import manager # Local import to avoid circular dependency
        # This requires manager to be accessible and a method to fetch WebSocket for broadcasting
        # This is a simplified call, actual broadcast needs participant lists or similar
        await manager.broadcast_user_update_for_profile_change(
            user_id=current_user.id,
            updated_data={"mood": refreshed_user_response.data["mood"]}
        )

    return UserPublic(**refreshed_user_response.data)


@user_router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar(
    file: UploadFile = File(...), 
    current_user: UserPublic = Depends(get_current_active_user)
):
    # The actual upload to Cloudinary happens in the /uploads/avatar endpoint
    # This endpoint is for associating the uploaded avatar URL with the user
    # This assumes the frontend first uploads to /uploads/avatar, gets a URL,
    # then calls PUT /users/me/profile with { "avatar_url": "new_url" }
    # For direct upload and update here:
    from app.routers.uploads import upload_avatar_to_cloudinary # Assuming a helper function
    
    try:
        file_url = await upload_avatar_to_cloudinary(file) # This helper needs to be created in uploads.py
    except HTTPException as e:
        raise e # Re-raise upload error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Avatar upload processing failed: {str(e)}")

    update_data = {
        "avatar_url": file_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or avatar update failed")
    
    refreshed_user_response = await db_manager.get_table("users").select("*").eq("id", str(current_user.id)).single().execute()
    return UserPublic(**refreshed_user_response.data)

# Include routers in main.py
# from app.auth.routes import auth_router, user_router
# app.include_router(auth_router)
# app.include_router(user_router)
