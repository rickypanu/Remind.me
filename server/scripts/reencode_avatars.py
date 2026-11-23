"""Re-encode avatars uploaded before the hardening (finding S10). Optional, safe to run more than once.

Old uploads were stored exactly as the browser sent them: any "image/*" type, with EXIF / GPS data intact.
The serving route already refuses non-raster types (so a stored SVG can never run), but the photos' metadata is
still in the database. This pushes every stored avatar through the same pipeline new uploads use
(256x256 WebP, no metadata).

    python -m scripts.reencode_avatars                    # dry run: lists what would change
    python -m scripts.reencode_avatars --apply            # re-encodes what can be re-encoded
    python -m scripts.reencode_avatars --apply --delete-invalid
                                                          # ...and removes avatars that are not valid images
                                                          # (also clears that user's avatar_url)
"""

import argparse
import asyncio
import contextlib
import sys
from datetime import UTC, datetime
from typing import Any

from bson import Binary

from app.services.avatars import AvatarError, process_avatar_bytes

WEBP = "image/webp"


async def run(db: Any, *, apply: bool, delete_invalid: bool) -> dict[str, int]:
    counts = {"already_clean": 0, "reencoded": 0, "invalid": 0, "deleted": 0}
    docs = [doc async for doc in db["avatars"].find({})]
    for doc in docs:
        user_id = doc["_id"]
        if doc.get("content_type") == WEBP and doc.get("reencoded"):
            counts["already_clean"] += 1
            continue
        try:
            processed = process_avatar_bytes(bytes(doc["data"]))
        except AvatarError as exc:
            counts["invalid"] += 1
            print(f"  {user_id}: not a usable image ({exc.message})")
            if apply and delete_invalid:
                await db["avatars"].delete_one({"_id": user_id})
                await _clear_avatar_url(db, user_id)
                counts["deleted"] += 1
            continue
        counts["reencoded"] += 1
        print(f"  {user_id}: {doc.get('content_type')} -> {processed.content_type}")
        if apply:
            await db["avatars"].update_one(
                {"_id": user_id},
                {
                    "$set": {
                        "data": Binary(processed.data),
                        "content_type": processed.content_type,
                        "updated_at": datetime.now(UTC),
                        "reencoded": True,
                    }
                },
            )
    return counts


async def _clear_avatar_url(db: Any, user_id: str) -> None:
    from bson import ObjectId

    # an avatar row whose id is not a valid user id has no user to clear
    with contextlib.suppress(Exception):
        await db["users"].update_one({"_id": ObjectId(user_id)}, {"$set": {"avatar_url": None}})


async def main(apply: bool, delete_invalid: bool) -> int:
    from app.db.client import open_database  # imported late so `--help` works without a configured .env

    client, db = open_database()

    try:
        counts = await run(db, apply=apply, delete_invalid=delete_invalid)
        print(f"\n{counts}")
        if not apply:
            print("Dry run. Re-run with --apply to make these changes.")
        return 0
    finally:
        await client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--delete-invalid", action="store_true")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.apply, args.delete_invalid)))
