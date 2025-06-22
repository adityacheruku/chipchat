
import redis.asyncio as redis
from app.config import settings
from app.utils.logging import logger

class RedisManager:
    def __init__(self, url: str):
        self._url = url
        self.redis_client: redis.Redis | None = None
        self.pubsub_client: redis.client.PubSub | None = None
        logger.info("RedisManager initialized.")

    async def connect(self):
        try:
            self.redis_client = redis.from_url(self._url, decode_responses=True)
            await self.redis_client.ping()
            self.pubsub_client = self.redis_client.pubsub(ignore_subscribe_messages=True)
            logger.info("Successfully connected to Redis.")
        except Exception as e:
            logger.error(f"Could not connect to Redis: {e}", exc_info=True)
            self.redis_client = None
            self.pubsub_client = None

    async def get_client(self) -> redis.Redis:
        if not self.redis_client:
            await self.connect()
        if not self.redis_client:
             raise ConnectionError("Failed to connect to Redis.")
        return self.redis_client

    async def get_pubsub(self) -> redis.client.PubSub:
        if not self.pubsub_client:
            await self.connect()
        if not self.pubsub_client:
             raise ConnectionError("Failed to initialize Redis Pub/Sub.")
        return self.pubsub_client

    async def close(self):
        if self.pubsub_client:
            await self.pubsub_client.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Redis connection closed.")


redis_manager = RedisManager(settings.REDIS_URL)

async def get_redis_client() -> redis.Redis:
    return await redis_manager.get_client()

async def get_pubsub_client() -> redis.client.PubSub:
    return await redis_manager.get_pubsub()
