
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request

from app.middleware.logging import LoggingMiddleware
from app.config import settings # Used by other modules, good to ensure it's importable

# Import routers
from app.auth.routes import auth_router, user_router
from app.chat.routes import router as chat_router
from app.routers.uploads import router as uploads_router # Corrected path
from app.routers.ws import router as ws_router
from app.routers.ai import router as ai_router # Ensure AI router is included if used
from app.routers.stickers import router as stickers_router # Import the new sticker router

app = FastAPI(
    title="ChirpChat API",
    description="Backend API for ChirpChat - Emotionally Intelligent Chat Application",
    version="1.0.0", # Consider updating version for new changes
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend integration
# Ensure origins match your frontend development and deployed URLs
base_origins = [
    "http://localhost:3000", # Common CRA/Next.js dev port
    "http://localhost:9002", # Your Next.js dev port from package.json
    # Add your Vercel deployment preview and production URLs here eventually
    # Example: "https://your-project-name.vercel.app",
    # Example: "https://your-project-name-*.vercel.app"
]

if settings.DEBUG:
    # For local development with DEBUG=true, allow all origins for easier testing.
    # WARNING: Do NOT use ["*"] in production.
    effective_origins = ["*"]
    print("DEBUG mode is ON. Allowing all origins for CORS. THIS IS NOT SAFE FOR PRODUCTION.")
else:
    # For production, use a specific list. Add your deployed frontend URLs here.
    # e.g., if your frontend is deployed to Vercel:
    # production_origins = [
    #     "https://your-app-name.vercel.app",
    #     "https://your-custom-domain.com",
    # ]
    # effective_origins = base_origins + production_origins
    effective_origins = base_origins # Default to base if no specific prod URLs yet


app.add_middleware(
    CORSMiddleware,
    allow_origins=effective_origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

app.add_middleware(LoggingMiddleware)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from app.utils.logging import logger # Local import to avoid issues if logger not fully set up
    # Consider logging the full traceback for unhandled exceptions
    import traceback
    logger.error(f"Unhandled error: {exc}\nTraceback: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred.", "error_type": type(exc).__name__} # More structured error
    )

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    # Can be expanded to check DB connection, etc.
    return {"status": "healthy", "service": "chirpchat-api", "version": app.version}

# Include all routers
app.include_router(auth_router) # Prefix is /auth
app.include_router(user_router) # Prefix is /users
app.include_router(chat_router) # Prefix is /chats
app.include_router(uploads_router) # Prefix is /uploads
app.include_router(ws_router) # Prefix is /ws
app.include_router(ai_router) # Prefix is /ai
app.include_router(stickers_router) # Prefix is /stickers

# Mount WebSocket endpoint (Alternative: include ws_router which already defines it)
# from app.routers.ws import websocket_endpoint
# app.add_api_websocket_route("/ws/connect", websocket_endpoint) # If ws_router isn't used directly
