import asyncio, os
from dotenv import load_dotenv
from pymongo import AsyncMongoClient

load_dotenv()

async def main():
    c = AsyncMongoClient(os.environ["MONGODB_URL"], serverSelectionTimeoutMS=8000)
    try:
        print("OK:", await c.admin.command("ping"))
    except Exception as e:
        print(type(e).__name__, "->", e)

asyncio.run(main())