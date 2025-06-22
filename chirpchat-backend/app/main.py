
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import redis.asyncio as redis
from prometheus_fastapi_instrumentator import Instrumentator

from app.middleware.logging import LoggingMiddleware
from app.config import settings
from app.websocket import manager as ws_manager
from app.utils.logging import logger
from app.redis_client import redis_manager

# Import routers
from app.auth.routes import auth_router, user_router
from app.chat.routes import router as chat_router
from app.routers.uploads import router as uploads_router
from app.routers.ws import router as ws_router
from app.routers.ai import router as ai_router
from app.routers.stickers import router as stickers_router
from app.notifications.routes import router as notifications_router
from app.routers.partners import router as partners_router
from app.routers.events import router as events_router # Import the new events router

app = FastAPI(
    title="ChirpChat API",
    description="Backend API for ChirpChat - Emotionally Intelligent Chat Application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Instrument the app with Prometheus metrics.
# This exposes a /metrics endpoint.
Instrumentator(
    excluded_handlers=["/metrics", "/health"],
).instrument(app).expose(app)


# Define allowed origins for CORS.
origins = [
    "http://localhost:3000",
    "http://localhost:9002",
    "https://ef9e-49-43-230-78.ngrok-free.app", # Updated ngrok link
    "https://chipchat.vercel.app", # Allow any vercel subdomain
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
    import traceback
    logger.error(f"Unhandled error: {exc}\nTraceback: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred.", "error_type": type(exc).__name__}
    )

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """
    Performs a health check of the API and its critical dependencies (e.g., Redis).
    Returns HTTP 200 if healthy, HTTP 503 if a dependency is down.
    """
    redis_healthy = False
    try:
        redis_client = await redis_manager.get_client()
        await redis_client.ping()
        redis_healthy = True
    except (redis.ConnectionError, ConnectionRefusedError, redis.TimeoutError) as e:
        logger.error(f"Health check failed: Redis connection error - {e}")
        redis_healthy = False
    except Exception as e:
        logger.error(f"Health check failed: An unexpected error occurred with Redis - {e}")
        redis_healthy = False

    response_content = {
        "status": "healthy" if redis_healthy else "unhealthy",
        "service": "chirpchat-api",
        "version": app.version,
        "dependencies": {
            "redis": "healthy" if redis_healthy else "unhealthy"
        }
    }
    
    if not redis_healthy:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=response_content)
    
    return JSONResponse(status_code=status.HTTP_200_OK, content=response_content)


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
app.include_router(events_router) # Include the new events router
