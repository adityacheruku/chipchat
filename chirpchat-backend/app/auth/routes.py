
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.auth.schemas import UserCreate, UserLogin, UserUpdate, UserPublic, Token
# 🔒 Security: Import the new dependency for the /refresh endpoint.
from app.auth.dependencies import get_current_user, get_current_active_user, get_user_from_refresh_token
# 🔒 Security: Import refresh token creation utility.
from app.utils.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.database import db_manager
from app.config import settings
from app.utils.email_utils import send_login_notification_email
from app.utils.logging import logger
from postgrest.exceptions import APIError
from app.websocket import manager as ws_manager
from app.notifications.service import notification_service


auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])

@auth_router.post("/register", response_model=Token)
async def register(user_create: UserCreate):
    existing_user_data = None
    try:
        logger.info(f"Checking for existing user with phone: {user_create.phone}")
        existing_user_response_obj = await db_manager.get_table("users").select("id").eq("phone", user_create.phone).maybe_single().execute()
        
        if existing_user_response_obj and hasattr(existing_user_response_obj, 'data') and existing_user_response_obj.data:
            existing_user_data = existing_user_response_obj.data
            logger.info(f"User check: Found existing user data for phone {user_create.phone}.")
        else:
            logger.info(f"User check: No existing user found with phone {user_create.phone}. Proceeding with registration.")
            existing_user_data = None

    except APIError as e:
        logger.error(f"APIError while checking for existing user with phone {user_create.phone}: Status Code: {getattr(e, 'code', 'N/A')}, Message: {getattr(e, 'message', 'N/A')}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while checking for existing user.",
        )
    
    if existing_user_data:
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
        "is_active": True,
        "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    logger.info(f"Attempting to register new user with data: {new_user_data}")

    insert_response_obj = None
    try:
        insert_response_obj = await db_manager.admin_client.table("users").insert(new_user_data).execute()
    except APIError as e:
        logger.error(f"PostgREST APIError during user insert. Status: {getattr(e, 'code', 'N/A')}, Message: {getattr(e, 'message', 'N/A')}, Details: {getattr(e, 'details', 'N/A')}, Hint: {getattr(e, 'hint', 'N/A')}", exc_info=True)
        logger.error(f"Payload that caused APIError: {new_user_data}")
        error_detail_json = "Could not parse error JSON from PostgREST."
        try:
            error_detail_json = e.json() if hasattr(e, 'json') and callable(e.json) else str(e)
        except Exception:
            pass
        logger.error(f"Full APIError details (if available): {error_detail_json}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user creation: {getattr(e, 'message', 'Unknown database error')}",
        )
    except Exception as e:
        logger.error(f"Unexpected error during user insert: {str(e)}", exc_info=True)
        logger.error(f"Payload that caused error: {new_user_data}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during user creation: {str(e)}",
        )

    if not insert_response_obj or not hasattr(insert_response_obj, 'data') or not insert_response_obj.data or not isinstance(insert_response_obj.data, list) or len(insert_response_obj.data) == 0:
        logger.error(f"User insert operation returned no data or invalid data. Payload: {new_user_data}. Response: {insert_response_obj}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user after database operation (no data returned).",
        )
    
    created_user_raw = insert_response_obj.data[0]
    logger.info(f"User successfully created with ID: {created_user_raw['id']}")
    
    user_public_info = UserPublic(
        id=created_user_raw["id"],
        display_name=created_user_raw["display_name"],
        avatar_url=created_user_raw["avatar_url"],
        mood=created_user_raw["mood"],
        phone=created_user_raw.get("phone"),
        email=created_user_raw.get("email"),
        is_online=created_user_raw["is_online"],
        last_seen=created_user_raw.get("last_seen")
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": created_user_raw["phone"], "user_id": str(created_user_raw["id"])},
        expires_delta=access_token_expires
    )
    # 🔒 Security: Create a refresh token upon successful registration.
    refresh_token = create_refresh_token(
        data={"sub": created_user_raw["phone"], "user_id": str(created_user_raw["id"])}
    )
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user=user_public_info)


@auth_router.post("/login", response_model=Token)
async def login(
    request: Request,
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    logger.info(f"Login attempt for phone: {form_data.username}")

    user_response_obj = None
    try:
        user_response_obj = await db_manager.get_table("users").select("*").eq("phone", form_data.username).maybe_single().execute()
    
    except APIError as e:
        logger.error(
            f"Supabase APIError during login for phone {form_data.username}: "
            f"Status Code: {getattr(e, 'code', 'N/A')}, Message: {getattr(e, 'message', 'N/A')}, "
            f"Details: {getattr(e, 'details', 'N/A')}, Hint: {getattr(e, 'hint', 'N/A')}", 
            exc_info=True
        )
        detail_msg = "Error communicating with the authentication service. Please try again later."
        if hasattr(e, 'code') and e.code == 406:
             logger.warning(f"Received 406 Not Acceptable from Supabase for user {form_data.username}. This may indicate RLS policy issues or other access restrictions.")
             detail_msg = "Login failed: Could not retrieve user details due to server configuration. Please contact support."
        
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=detail_msg,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error during Supabase call for login (phone {form_data.username}): {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred while trying to log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user_response_obj is None:
        logger.error(f"Login attempt for phone {form_data.username} resulted in a 'None' database response object. This typically indicates a problem with the database query execution or connection not caught as an APIError.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error communicating with the database during login.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_dict_from_db = user_response_obj.data 
    
    if user_dict_from_db is None:
        logger.warning(f"Login attempt failed for phone: {form_data.username} - User not found in DB (response.data is None).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user_dict_from_db["hashed_password"]):
        logger.warning(f"Login attempt failed for phone: {form_data.username} - Incorrect password.")
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
    # 🔒 Security: Create a refresh token upon successful login.
    refresh_token = create_refresh_token(
        data={"sub": user_dict_from_db["phone"], "user_id": str(user_dict_from_db["id"])}
    )
    
    if settings.NOTIFICATION_EMAIL_TO:
        login_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        client_host = request.client.host if request.client else "Unknown IP"
        background_tasks.add_task(
            send_login_notification_email,
            logged_in_user_name=user_dict_from_db["display_name"],
            logged_in_user_phone=user_dict_from_db.get("phone"),
            login_time=login_time_utc,
            client_host=client_host
        )
        logger.info(f"Login notification task added for user: {user_dict_from_db['display_name']}")
    else:
        logger.info(f"NOTIFICATION_EMAIL_TO not set. Skipping login notification email for user: {user_dict_from_db['display_name']}")

    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user=user_public_info)

# 🔒 Security: Add a /refresh endpoint to issue a new access token using a valid refresh token.
@auth_router.post("/refresh", response_model=Token, summary="Refresh access token")
async def refresh_access_token(current_user: UserPublic = Depends(get_user_from_refresh_token)):
    """
    Takes a valid `refresh_token` and returns a new `access_token` and a new `refresh_token`.
    This allows clients to maintain their session without requiring the user to log in again.
    """
    logger.info(f"Refreshing tokens for user {current_user.id}")
    
    # The `get_user_from_refresh_token` dependency has already validated the refresh token
    # and loaded the current user's data. Now we just issue a new set of tokens.
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": current_user.phone, "user_id": str(current_user.id)},
        expires_delta=access_token_expires
    )
    
    # 🔒 Security: Implement refresh token rotation by issuing a new refresh token.
    new_refresh_token = create_refresh_token(
         data={"sub": current_user.phone, "user_id": str(current_user.id)}
    )
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=current_user
    )


@user_router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserPublic = Depends(get_current_active_user)):
    return current_user

@user_router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: UUID, current_user_dep: UserPublic = Depends(get_current_user)):
    user_response_obj = await db_manager.get_table("users").select(
        "id, display_name, avatar_url, mood, phone, email, is_online, last_seen"
    ).eq("id", str(user_id)).maybe_single().execute()
    
    if not user_response_obj or not user_response_obj.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**user_response_obj.data)

@user_router.put("/me/profile", response_model=UserPublic)
async def update_profile(
    profile_update: UserUpdate,
    current_user: UserPublic = Depends(get_current_active_user)
):
    update_data = profile_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if "password" in update_data and update_data["password"]:
        del update_data["password"] 

    logger.info(f"User {current_user.id} updating profile with data: {update_data}")
    if "mood" in update_data:
        logger.info(f"User {current_user.id} attempting to update mood to: {update_data['mood']}")

    updated_user_response_obj = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response_obj or not hasattr(updated_user_response_obj, 'data') or not updated_user_response_obj.data or not isinstance(updated_user_response_obj.data, list) or len(updated_user_response_obj.data) == 0:
        logger.error(f"Profile update failed for user {current_user.id} or user not found after update.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")

    refreshed_user_data = updated_user_response_obj.data[0]
    logger.info(f"User {current_user.id} profile updated successfully. New mood (if changed): {refreshed_user_data.get('mood')}")
    
    # Broadcast profile update via Redis Pub/Sub
    await ws_manager.broadcast_user_profile_update(
        user_id=current_user.id,
        updated_data={"mood": refreshed_user_data['mood']}
    )
    
    if "mood" in update_data and refreshed_user_data.get('mood') != current_user.mood:
        await notification_service.send_mood_change_notification(
            user=current_user, 
            new_mood=refreshed_user_data['mood']
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
    from app.routers.uploads import upload_avatar_to_cloudinary 
    
    try:
        file_url = await upload_avatar_to_cloudinary(file)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Avatar upload processing failed for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar upload processing failed.")

    update_data = {
        "avatar_url": file_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    logger.info(f"User {current_user.id} updating avatar. New URL: {file_url}")
    updated_user_response_obj = await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    
    if not updated_user_response_obj or not hasattr(updated_user_response_obj, 'data') or not updated_user_response_obj.data or not isinstance(updated_user_response_obj.data, list) or len(updated_user_response_obj.data) == 0:
        logger.error(f"Avatar URL update in DB failed for user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or avatar update failed")
    
    refreshed_user_data = updated_user_response_obj.data[0]
    logger.info(f"User {current_user.id} avatar updated successfully in DB.")
    
    await ws_manager.broadcast_user_profile_update(
        user_id=current_user.id,
        updated_data={"avatar_url": refreshed_user_data["avatar_url"]}
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

@user_router.post("/{recipient_user_id}/ping-thinking-of-you", status_code=status.HTTP_200_OK)
async def http_ping_thinking_of_you(
    recipient_user_id: UUID,
    current_user: UserPublic = Depends(get_current_active_user)
):
    logger.info(f"User {current_user.id} ({current_user.display_name}) is sending 'Thinking of You' ping to user {recipient_user_id} via HTTP.")

    recipient_check_resp_obj = await db_manager.get_table("users").select("id").eq("id", str(recipient_user_id)).maybe_single().execute()
    if not recipient_check_resp_obj or not recipient_check_resp_obj.data:
        logger.warning(f"HTTP Ping: Recipient user {recipient_user_id} not found in DB.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found.")

    if recipient_user_id == current_user.id:
        logger.info(f"User {current_user.id} attempted to ping themselves via HTTP. Action not sent via WebSocket.")
        return {"status": "Ping to self noted, not sent."}

    try:
        # Broadcast via Redis Pub/Sub
        await ws_manager.broadcast_to_users(
            user_ids=[recipient_user_id],
            payload={
                "event_type": "thinking_of_you_received",
                "sender_id": str(current_user.id),
                "sender_name": current_user.display_name, 
            }
        )
        logger.info(f"'Thinking of You' event published to Redis from user {current_user.id} to {recipient_user_id} via HTTP route.")
        
        # Send Push Notification
        await notification_service.send_thinking_of_you_notification(
            sender=current_user,
            recipient_id=recipient_user_id
        )

        return {"status": "Ping sent"}
    except Exception as e:
        logger.error(f"Failed to dispatch 'Thinking of You' events for recipient {recipient_user_id} from user {current_user.id} via HTTP: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send ping.")
