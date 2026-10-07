import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

# Create the async MongoDB client
# tz_aware=True -> datetimes read back are UTC-aware, so JSON always ends in "Z"/+00:00
client = AsyncIOMotorClient(MONGODB_URL, tz_aware=True)
db = client[DATABASE_NAME]

# Dependency to get the database instance
def get_db():
    return db