
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional
import random

from app.auth.schemas import UserCreate, UserLogin, UserUpdate, UserPublic, Token, PhoneSchema, VerifyOtpRequest, VerifyOtpResponse, CompleteRegistrationRequest, PasswordChangeRequest
# 🔒 Security: Import the new dependency for the /refresh endpoint.
from app.auth.dependencies import get_current_user, get_current_active_user, get_user_from_refresh_token
# 🔒 Security: Import refresh and registration token creation utilities.
from app.utils.security import get_password_hash, verify_password, create_access_token, create_refresh_token, create_registration_token, verify_registration_token
from app.database import db_manager
from app.config import settings
from app.utils.email_utils import send_login_notification_email
from app.utils.logging import logger
from postgrest.exceptions import APIError
from app.websocket import manager as ws_manager
from app.notifications.service import notification_service
from app.redis_client import get_redis_client

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])


# 🔒 Security: New endpoint to start the OTP-based registration flow.
@auth_router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_otp(phone_data: PhoneSchema):
    """
    Checks if a phone number is available and sends an OTP.
    In a real app, this would use an SMS service like Twilio.
    For development, the OTP is logged to the console.
    """
    phone = phone_data.phone
    logger.info(f"OTP requested for phone: {phone}")
    
    # Check if user already exists
    existing_user_resp = await db_manager.get_table("users").select("id").eq("phone", phone).maybe_single().execute()
    if existing_user_resp and existing_user_resp.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone number already registered.")

    # Generate and store OTP
    otp = f"{random.randint(100000, 999999)}"
    redis = await get_redis_client()
    await redis.set(f"otp:{phone}", otp, ex=300) # 5-minute expiry

    # --- SIMULATED SMS SENDING ---
    # In a real application, you would integrate with an SMS gateway here.
    # e.g., await send_sms(phone, f"Your ChirpChat verification code is: {otp}")
    logger.info(f"====== DEV ONLY: OTP for {phone} is {otp} ======")
    # Do NOT return the OTP in the response in production.
    
    return {"message": "OTP has been sent."}


# 🔒 Security: New endpoint to verify the OTP and get a temporary registration token.
@auth_router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(request_data: VerifyOtpRequest):
    """
    Verifies the provided OTP for a phone number.
    If successful, returns a short-lived registration token required for completing registration.
    """
    phone = request_data.phone
    otp = request_data.otp
    
    redis = await get_redis_client()
    stored_otp = await redis.get(f"otp:{phone}")

    if not stored_otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired or not found. Please request a new one.")
    
    if stored_otp != otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP.")
    
    # OTP is correct, remove it from Redis
    await redis.delete(f"otp:{phone}")

    # Generate a temporary token to authorize the next step
    registration_token = create_registration_token(phone=phone)
    
    return VerifyOtpResponse(registration_token=registration_token)


# 🔒 Security: The final registration step, now requires a valid registration token.
@auth_router.post("/complete-registration", response_model=Token, summary="Complete user registration")
async def complete_registration(reg_data: CompleteRegistrationRequest):
    """
    Completes the user registration process after phone verification.
    Requires a valid registration_token from the /verify-otp endpoint.
    """
    # Verify the registration token
    phone = verify_registration_token(reg_data.registration_token)
    if not phone:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired registration token.")

    # Double-check that user doesn't exist (race condition mitigation)
    existing_user_resp = await db_manager.get_table("users").select("id").eq("phone", phone).maybe_single().execute()
    if existing_user_resp and existing_user_resp.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone number was registered by another user. Please start over.")

    hashed_password = get_password_hash(reg_data.password)
    user_id = uuid4()
    
    new_user_data = {
        "id": str(user_id),
        "phone": phone,
        "email": reg_data.email,
        "hashed_password": hashed_password,
        "display_name": reg_data.display_name,
        "avatar_url": f"https://placehold.co/100x100.png?text={reg_data.display_name[:1].upper()}",
        "mood": "Neutral",
        "is_active": True,
        "is_online": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    logger.info(f"Attempting to complete registration for user with phone {phone}")

    try:
        # 🔑 Security Fix: Use the admin client (service_role key) to insert into the users table.
        # This is a protected operation that cannot be done with the public anon key.
        insert_response_obj = await db_manager.admin_client.table("users").insert(new_user_data).execute()
    except APIError as e:
        logger.error(f"PostgREST APIError during user insert. Details: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user creation: {getattr(e, 'message', 'Unknown database error')}",
        )
    
    if not insert_response_obj or not insert_response_obj.data:
        logger.error(f"User insert operation returned no data. Payload: {new_user_data}.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user after database operation.",
        )
    
    created_user_raw = insert_response_obj.data[0]
    logger.info(f"User successfully created with ID: {created_user_raw['id']}")
    
    user_public_info = UserPublic.model_validate(created_user_raw)

    access_token = create_access_token(data={"sub": created_user_raw["phone"], "user_id": str(created_user_raw["id"])})
    refresh_token = create_refresh_token(data={"sub": created_user_raw["phone"], "user_id": str(created_user_raw["id"])})
    
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
            f"Supabase APIError during login for phone {form_data.username}: {e}", 
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Error communicating with the authentication service.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error during Supabase call for login (phone {form_data.username}): {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred while trying to log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_dict_from_db = user_response_obj.data if user_response_obj else None
    
    if user_dict_from_db is None:
        logger.warning(f"Login attempt failed for phone: {form_data.username} - User not found in DB.")
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

    user_public_info = UserPublic.model_validate(user_dict_from_db)
    
    access_token = create_access_token(data={"sub": user_dict_from_db["phone"], "user_id": str(user_dict_from_db["id"])})
    refresh_token = create_refresh_token(data={"sub": user_dict_from_db["phone"], "user_id": str(user_dict_from_db["id"])})
    
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

    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user=user_public_info)

# 🔒 Security: Add a /refresh endpoint to issue a new access token using a valid refresh token.
@auth_router.post("/refresh", response_model=Token, summary="Refresh access token")
async def refresh_access_token(current_user: UserPublic = Depends(get_user_from_refresh_token)):
    """
    Takes a valid `refresh_token` and returns a new `access_token` and a new `refresh_token`.
    This allows clients to maintain their session without requiring the user to log in again.
    """
    logger.info(f"Refreshing tokens for user {current_user.id}")
    
    access_token = create_access_token(data={"sub": current_user.phone, "user_id": str(current_user.id)})
    refresh_token = create_refresh_token(data={"sub": current_user.phone, "user_id": str(current_user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=current_user
    )


@user_router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserPublic = Depends(get_current_active_user)):
    return current_user

@user_router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: UUID, current_user_dep: UserPublic = Depends(get_current_user)):
    user_response_obj = await db_manager.get_table("users").select(
        "id, display_name, avatar_url, mood, phone, email, is_online, last_seen, partner_id"
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

    await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    updated_user_response_obj = await db_manager.get_table("users").select("*").eq("id", str(current_user.id)).maybe_single().execute()
    
    if not updated_user_response_obj or not updated_user_response_obj.data:
        logger.error(f"Profile update failed for user {current_user.id} or user not found after update.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")

    refreshed_user_data = updated_user_response_obj.data
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

    return UserPublic.model_validate(refreshed_user_data)


@user_router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: UserPublic = Depends(get_current_active_user)
):
    # Fetch user with hashed_password
    user_response_obj = await db_manager.get_table("users").select("hashed_password").eq("id", str(current_user.id)).single().execute()
    user_in_db = user_response_obj.data
    
    if not verify_password(password_data.current_password, user_in_db["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password.")

    new_hashed_password = get_password_hash(password_data.new_password)
    await db_manager.get_table("users").update({"hashed_password": new_hashed_password, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(current_user.id)).execute()
    
    logger.info(f"User {current_user.id} successfully changed their password.")
    return None

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
    
    await db_manager.get_table("users").update(update_data).eq("id", str(current_user.id)).execute()
    updated_user_response_obj = await db_manager.get_table("users").select("*").eq("id", str(current_user.id)).maybe_single().execute()
    
    if not updated_user_response_obj or not updated_user_response_obj.data:
        logger.error(f"Avatar URL update in DB failed for user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or avatar update failed")
    
    refreshed_user_data = updated_user_response_obj.data
    logger.info(f"User {current_user.id} avatar updated successfully in DB.")
    
    await ws_manager.broadcast_user_profile_update(
        user_id=current_user.id,
        updated_data={"avatar_url": refreshed_user_data["avatar_url"]}
    )

    return UserPublic.model_validate(refreshed_user_data)

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

    