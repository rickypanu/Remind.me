"""MongoDB client factory.

Uses PyMongo's native async API (``AsyncMongoClient``). Motor, which this project used before,
was deprecated on 14 May 2025 in favour of it and reached end of life on 14 May 2026
(https://motor.readthedocs.io/en/latest/). The collection API the routes use
(``find_one``, ``find``, ``update_one``, ``insert_one``, ``delete_many``, ``to_list``, ``async for``) is the same.
One difference to remember: ``await client.close()``, and ``aggregate()`` must be awaited.
"""

from typing import Any

from pymongo import AsyncMongoClient

from app.core.config import Settings, get_settings


def create_mongo_client(settings: Settings) -> AsyncMongoClient:
    return AsyncMongoClient(
        settings.mongodb_url.get_secret_value(),
        tz_aware=True,  # datetimes read back are UTC-aware, so JSON always carries an offset
        serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
        maxPoolSize=settings.mongodb_max_pool_size,
        minPoolSize=settings.mongodb_min_pool_size,
        maxIdleTimeMS=settings.mongodb_max_idle_ms,
        **({"compressors": "zlib"} if settings.mongodb_compression else {}),
        appname="remindme-api",
    )


def open_database(settings: Settings | None = None) -> tuple[AsyncMongoClient, Any]:
    """``(client, db)`` for scripts and one-off tools. The caller must ``await client.close()``."""
    settings = settings or get_settings()
    client = create_mongo_client(settings)
    return client, client[settings.database_name]
