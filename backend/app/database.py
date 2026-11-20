import logging
from motor.motor_asyncio import AsyncIOMotorClient
from .config import get_settings

logger = logging.getLogger(__name__)
_client: AsyncIOMotorClient | None = None

async def connect_db():
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_url)
    try:
        await _client[settings.database_name].command("ping")
        logger.info("Successfully connected to MongoDB database: %s", settings.database_name)
    except Exception as e:
        logger.error("Failed to ping MongoDB: %s", e)

async def close_db():
    global _client
    if _client:
        _client.close()
        logger.info("Closed MongoDB connection")

def get_db():
    settings = get_settings()
    return _client[settings.database_name]
