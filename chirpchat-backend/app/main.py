
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
import asyncio

from app.middleware.logging import LoggingMiddleware
from app.config import settings
from app.websocket import manager as ws_manager

# Import routers
from app.auth.routes import auth_router, user_router
from app.chat.routes import router as chat_router
from app.routers.uploads import router as uploads_router
from app.routers.ws import router as ws_router
from app.routers.ai import router as ai_router
from app.routers.stickers import router as stickers_router
from app.notifications.routes import router as notifications_router
from app.routers.partners import router as partners_router

app = FastAPI(
    title="ChirpChat API",
    description="Backend API for ChirpChat - Emotionally Intelligent Chat Application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Define allowed origins for CORS.
origins = [
    "http://localhost:3000",
    "http://localhost:9002",
    "https://a93b-49-43-230-78.ngrok-free.app",
    "https://*.vercel.app", # Allow any vercel subdomain
]

allowed_origins = ["*"] if settings.DEBUG else origins
if settings.DEBUG:
    print("DEBUG mode is ON. Allowing all origins for CORS. THIS IS NOT SAFE FOR PRODUCTION.")

@app.on_event("startup")
async def startup_event():
    # Start the Redis Pub/Sub listener
    asyncio.create_task(ws_manager.listen_for_broadcasts())
    print("FastAPI application startup complete. Redis listener running.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from app.utils.logging import logger
    import traceback
    logger.error(f"Unhandled error: {exc}\nTraceback: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred.", "error_type": type(exc).__name__}
    )

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "chirpchat-api", "version": app.version}

# Include all routers
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(chat_router)
app.include_router(uploads_router)
app.include_router(ws_router)
app.include_router(ai_router)
app.include_router(stickers_router)
app.include_router(notifications_router)
app.include_router(partners_router)
