
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm 
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.auth.schemas import UserCreate, UserLogin, UserUpdate, UserPublic, Token
from app.auth.dependencies import get_current_user, get_current_active_user
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.database import db_manager
from app.config import settings
from app.utils.email_utils import send_login_notification_email
from app.utils.logging import logger 
from postgrest.exceptions import APIError 

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])

@auth_router.post("/register", response_model=Token)
async def register(user_create: UserCreate):
    existing_user_data = None
    try:
        logger.info(f"Checking for existing user with phone: {user_create.phone}")
        existing_user_response = await db_manager.get_table("users").select("id").eq("phone", user_create.phone).maybe_single().execute()
        if existing_user_response and existing_user_response.data:
            existing_user_data = existing_user_response.data
    except APIError as e:
        # PostgREST can return specific codes for "no rows found" which aren't true errors for a "check if exists" query.
        # For example, a 204 No Content might be returned by some configurations if maybe_single() finds nothing.
        # However, postgrest-py typically ensures .data is an empty list if no rows are found from maybe_single().
        # So, we mainly care about other API errors here.
        # Based on Postgrest docs, a select that finds 0 rows with maybe_single() should return data=[]
        # This '204' check might be legacy or for a different setup; for now, we assume if .data is empty, it's "not found".
        if e.code == "PGRST116": # PGRST116: "Requested range not satisfiable" (often means 0 rows for single/maybe_single)
            logger.info(f"No user found with phone {user_create.phone} (PGRST116), proceeding with registration.")
            existing_user_data = None 
        else:
            logger.error(f"APIError while checking for existing user with phone {user_create.phone}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while checking for existing user.",
            )
    
    if existing_user_data: # This implies existing_user_response.data was not empty
        logger.warning(f"Registration attempt for already registered phone: {user_create.phone}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )

    hashed_password = get_password_hash(user_create.password)
    user_id = uuid4()
    
    new_user_data = {
        "id": str(user_id),
        "phone": user_create.phone,
        "email": user_create.email, 
        "hashed_password": hashed_password,
        "display_name": user_create.display_name,
        "avatar_url": f"https://placehold.co/100x100.png?text={user_create.display_name[:1].upper()}",
        "mood": "Neutral",
        "is_active": True, # Assuming new users are active by default
        "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # last_seen is typically null on creation
    }
    
    logger.info(f"Attempting to register new user with data: {new_user_data}")

    insert_response = None
    try:
        # Use admin_client for user creation to bypass RLS if necessary for returning representation
        # RLS might prevent the anon key from reading the newly inserted user for the response.
        insert_response = await db_manager.admin_client.table("users").insert(new_user_data).execute()
    except APIError as e:
        logger.error(f"PostgREST APIError during user insert. Status: {e.code}, Message: {e.message}, Details: {e.details}, Hint: {e.hint}", exc_info=True)
        logger.error(f"Payload that caused APIError: {new_user_data}")
        error_detail_json = "Could not parse error JSON from PostgREST."
        try:
            error_detail_json = e.json() # Attempt to get JSON details if available
        except Exception:
            pass # Ignore if e.json() itself fails
        logger.error(f"Full APIError JSON (if available): {error_detail_json}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user creation: {e.message}", # Provide a user-friendly part of the error
        )
    except Exception as e: # Catch any other unexpected errors
        logger.error(f"Unexpected error during user insert: {str(e)}", exc_info=True)
        logger.error(f"Payload that caused error: {new_user_data}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during user creation: {str(e)}",
        )

    if not insert_response or not insert_response.data or len(insert_response.data) == 0:
        logger.error(f"User insert operation returned no data or empty data. Payload: {new_user_data}. Response: {insert_response}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user after database operation (no data returned).",
        )
    
    created_user_raw = insert_response.data[0]
    logger.info(f"User successfully created with ID: {created_user_raw['id']}")
    
    # Construct UserPublic from the raw data returned by Supabase
    # Ensure all fields expected by UserPublic are present or handled (e.g., with .get() for optional ones)
    user_public_info = UserPublic(
        id=created_user_raw["id"],
        display_name=created_user_raw["display_name"],
        avatar_url=created_user_raw["avatar_url"],
        mood=created_user_raw["mood"],
        phone=created_user_raw.get("phone"), # Use .get() if phone might not be returned by this specific insert query/RLS
        email=created_user_raw.get("email"), # Use .get() for optional email
        is_online=created_user_raw["is_online"],
        last_seen=created_user_raw.get("last_seen") # Use .get() as it might be null
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": created_user_raw["phone"], "user_id": str(created_user_raw["id"])}, # Use phone for sub, as per login
        expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@auth_router.post("/login", response_model=Token)
async def login(
    request: Request,
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends() 
):
    logger.info(f"Login attempt for phone: {form_data.username}") # form_data.username holds the phone number

    user_response = await db_manager.get_table("users").select("*").eq("phone", form_data.username).maybe_single().execute()
    
    # Robust check:
    # 1. user_response object itself should not be None.
    # 2. user_response.data should not be None.
    # 3. user_response.data should be a list.
    # 4. That list should not be empty.
    if user_response is None or \
       not hasattr(user_response, 'data') or \
       user_response.data is None or \
       not isinstance(user_response.data, list) or \
       len(user_response.data) == 0:
        logger.warning(f"Login attempt failed for phone: {form_data.username} - User not found or API response error.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # If we reach here, user_response.data is a list with at least one item.
    # Since we used maybe_single(), it should be exactly one item if a user was found.
    user_dict_from_db = user_response.data[0] 
    
    if not verify_password(form_data.password, user_dict_from_db["hashed_password"]):
        logger.warning(f"Login attempt failed for phone: {form_data.username} - Incorrect password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"User {form_data.username} ({user_dict_from_db['display_name']}) successfully logged in.")

    user_public_info = UserPublic(
        id=user_dict_from_db["id"],
        display_name=user_dict_from_db["display_name"],
        avatar_url=user_dict_from_db["avatar_url"],
        mood=user_dict_from_db["mood"],
        phone=user_dict_from_db.get("phone"),
        email=user_dict_from_db.get("email"),
        is_online=user_dict_from_db["is_online"],
        last_seen=user_dict_from_db.get("last_seen")
    )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_dict_from_db["phone"], "user_id": str(user_dict_from_db["id"])},
        expires_delta=access_token_expires
    )
    
    # Send notification email if configured
    if settings.NOTIFICATION_EMAIL_TO:
        login_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        client_host = request.client.host if request.client else "Unknown IP"
        background_tasks.add_task(
            send_login_notification_email,
            logged_in_user_name=user_dict_from_db["display_name"],
            logged_in_user_phone=user_dict_from_db.get("phone"), # Using .get for safety
            login_time=login_time_utc,
            client_host=client_host
        )
        logger.info(f"Login notification task added for user: {user_dict_from_db['display_name']}")
    else:
        logger.info(f"NOTIFICATION_EMAIL_TO not set. Skipping login notification email for user: {user_dict_from_db['display_name']}")

    return Token(access_token=access_token, token_type="bearer", user=user_public_info)


@user_router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserPublic = Depends(get_current_active_user)):
    # current_user is already validated by get_current_active_user
    return current_user

@user_router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: UUID, current_user_dep: UserPublic = Depends(get_current_user)): # current_user_dep to ensure endpoint is protected
    user_response = await db_manager.get_table("users").select(
        "id, display_name, avatar_url, mood, phone, email, is_online, last_seen" # Explicitly list public fields
    ).eq("id", str(user_id)).maybe_single().execute()
    
    if not user_response or not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**user_response.data[0]) # Access the first item in the list

@user_router.put("/me/profile", response_model=UserPublic)
async def update_profile(
    profile_update: UserUpdate, 
    current_user: UserPublic = Depends(get_current_active_user)
):
    update_data = profile_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Prevent password update through this endpoint; should be a separate flow
    if "password" in update_data and update_data["password"]:
        # This should ideally not be in UserUpdate schema if not updatable here
        del update_data["password"] 

    logger.info(f"User {current_user.id} updating profile with data: {update_data}")
    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data or len(updated_user_response.data) == 0:
        logger.error(f"Profile update failed for user {current_user.id} or user not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")

    refreshed_user_data = updated_user_response.data[0]
    logger.info(f"User {current_user.id} profile updated successfully.")
    
    # Broadcast mood change if mood was updated
    # Check if 'mood' was in the update_data and it's different from current_user.mood (fetched by dependency)
    # and also ensure 'mood' is present in the refreshed_user_data
    if "mood" in update_data and "mood" in refreshed_user_data and update_data["mood"] != current_user.mood :
        from app.websocket.manager import manager # Local import to avoid circular dependency issues at startup
        logger.info(f"Mood changed for user {current_user.id} from {current_user.mood} to {refreshed_user_data['mood']}. Broadcasting update.")
        await manager.broadcast_user_update_for_profile_change(
            user_id=current_user.id,
            updated_data={"mood": refreshed_user_data['mood']}, # Only broadcast the changed mood
            db_manager_instance=db_manager # Pass db_manager if manager needs it for fetching recipients
        )

    return UserPublic(
        id=refreshed_user_data["id"],
        display_name=refreshed_user_data["display_name"],
        avatar_url=refreshed_user_data["avatar_url"],
        mood=refreshed_user_data["mood"],
        phone=refreshed_user_data.get("phone"),
        email=refreshed_user_data.get("email"),
        is_online=refreshed_user_data["is_online"],
        last_seen=refreshed_user_data.get("last_seen")
    )


@user_router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar_route(
    file: UploadFile = File(...), 
    current_user: UserPublic = Depends(get_current_active_user)
):
    from app.routers.uploads import upload_avatar_to_cloudinary # Local import for clarity or to break cycles
    
    try:
        file_url = await upload_avatar_to_cloudinary(file) # This helper does not need current_user if public_id is managed by Cloudinary
    except HTTPException as e:
        raise e # Re-raise HTTPExceptions from validation/upload
    except Exception as e:
        logger.error(f"Avatar upload processing failed for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar upload processing failed.")

    update_data = {
        "avatar_url": file_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    logger.info(f"User {current_user.id} updating avatar. New URL: {file_url}")
    updated_user_response = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response.data or len(updated_user_response.data) == 0:
        logger.error(f"Avatar URL update in DB failed for user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or avatar update failed")
    
    refreshed_user_data = updated_user_response.data[0]
    logger.info(f"User {current_user.id} avatar updated successfully in DB.")

    # Broadcast avatar update
    from app.websocket.manager import manager
    logger.info(f"Broadcasting avatar update for user {current_user.id}")
    await manager.broadcast_user_update_for_profile_change(
        user_id=current_user.id,
        updated_data={"avatar_url": refreshed_user_data["avatar_url"]}, # Only broadcast the avatar_url
        db_manager_instance=db_manager
    )

    return UserPublic(
         id=refreshed_user_data["id"],
        display_name=refreshed_user_data["display_name"],
        avatar_url=refreshed_user_data["avatar_url"],
        mood=refreshed_user_data["mood"],
        phone=refreshed_user_data.get("phone"),
        email=refreshed_user_data.get("email"),
        is_online=refreshed_user_data["is_online"],
        last_seen=refreshed_user_data.get("last_seen")
    )

