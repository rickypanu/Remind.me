"""One-off migration for the auth hardening (findings S8, S9). Run BEFORE deploying the new code.

Logins and sign-ups now lower-case e-mail addresses. Accounts stored with capitals ("Ricky@Gmail.com") would no
longer be found, so this script lower-cases them. It also deletes the legacy ``reset_token`` /
``reset_token_expires`` fields from ``users`` (reset tokens now live, hashed, in ``password_resets``).

    python -m scripts.normalize_emails            # dry run: prints what would change, changes nothing
    python -m scripts.normalize_emails --apply    # performs the changes

Two accounts whose addresses differ only by case cannot both become lower-case. Those are reported and left
untouched; decide by hand which one to keep (nothing is ever deleted by this script).
"""

import argparse
import asyncio
import sys
from collections import defaultdict
from typing import Any


async def plan(db: Any) -> tuple[list[tuple[Any, str, str]], dict[str, list[Any]], int]:
    """(renames, collisions, legacy_token_docs). Pure reads."""
    by_normalised: dict[str, list[tuple[Any, str]]] = defaultdict(list)
    async for user in db["users"].find({}, {"email": 1}):
        email = user.get("email")
        if isinstance(email, str):
            by_normalised[email.strip().lower()].append((user["_id"], email))

    renames: list[tuple[Any, str, str]] = []
    collisions: dict[str, list[Any]] = {}
    for normalised, members in by_normalised.items():
        if len(members) > 1:
            collisions[normalised] = [member_id for member_id, _ in members]
            continue
        member_id, current = members[0]
        if current != normalised:
            renames.append((member_id, current, normalised))

    legacy = await db["users"].count_documents(
        {"$or": [{"reset_token": {"$exists": True}}, {"reset_token_expires": {"$exists": True}}]}
    )
    return renames, collisions, legacy


async def apply(db: Any, renames: list[tuple[Any, str, str]]) -> None:
    for user_id, _old, new in renames:
        await db["users"].update_one({"_id": user_id}, {"$set": {"email": new}})
    await db["users"].update_many(
        {"$or": [{"reset_token": {"$exists": True}}, {"reset_token_expires": {"$exists": True}}]},
        {"$unset": {"reset_token": "", "reset_token_expires": ""}},
    )


async def main(do_apply: bool) -> int:
    from app.db.client import open_database  # imported late so `--help` works without a configured .env

    client, db = open_database()

    try:
        renames, collisions, legacy = await plan(db)
        print(f"{len(renames)} e-mail address(es) need lower-casing")
        for user_id, old, new in renames:
            print(f"  {user_id}: {old} -> {new}")
        print(f"{len(collisions)} case-only duplicate(s) (left untouched, resolve by hand)")
        for normalised, ids in collisions.items():
            print(f"  {normalised}: {', '.join(str(i) for i in ids)}")
        print(f"{legacy} user document(s) still carry legacy reset_token fields")

        if not do_apply:
            print("\nDry run. Re-run with --apply to make these changes.")
            return 1 if collisions else 0
        await apply(db, renames)
        print("\nApplied.")
        return 1 if collisions else 0
    finally:
        await client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="make the changes (default is a dry run)")
    sys.exit(asyncio.run(main(parser.parse_args().apply)))
