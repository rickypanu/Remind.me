"""A tiny in-memory stand-in for the async PyMongo collections the backend uses (tests only).

It implements just the subset of MongoDB semantics the code under test relies on:

  * filters: equality, ``$gt $gte $lt $lte $in $nin $ne $exists``, ``$or``, ``$and``; dotted paths that walk into
    arrays of sub-documents (``push_subscriptions.endpoint``) and array positions (``push_subscriptions.9``)
  * updates: ``$set`` (incl. the positional ``arr.$``), ``$unset``, ``$inc``, ``$push``, ``$pull``
  * ``$type: "string"``; cursors honour ``sort`` (several keys, either direction) and ``limit``
  * ``insert_one`` raises ``DuplicateKeyError`` for a repeated ``_id`` and for a repeated value of any key set in
    ``FakeCollection.unique`` (a partial unique index: documents lacking the key are not indexed);
    ``find_one_and_delete`` is atomic
  * ``modified_count`` is 0 when an update changed nothing, as in MongoDB
"""

import copy
from types import SimpleNamespace
from typing import Any

from pymongo.errors import DuplicateKeyError

_MISSING = object()


def _walk(values: list, part: str) -> list:
    out: list = []
    for value in values:
        if isinstance(value, dict):
            if part in value:
                out.append(value[part])
        elif isinstance(value, list):
            if part.isdigit():
                index = int(part)
                if index < len(value):
                    out.append(value[index])
            else:
                for element in value:
                    if isinstance(element, dict) and part in element:
                        out.append(element[part])
    return out


def _resolve(doc: dict, path: str) -> list:
    values: list = [doc]
    for part in path.split("."):
        values = _walk(values, part)
        if not values:
            return []
    return values


def _candidates(found: list) -> list:
    """Every value a condition may be compared with (a list value also matches through its elements)."""
    out: list = []
    for value in found:
        out.append(value)
        if isinstance(value, list):
            out.extend(value)
    return out


def _compare(candidate: Any, op: str, arg: Any) -> bool:
    try:
        if op == "$gt":
            return candidate > arg
        if op == "$gte":
            return candidate >= arg
        if op == "$lt":
            return candidate < arg
        if op == "$lte":
            return candidate <= arg
    except TypeError:
        return False
    raise AssertionError(op)


def _match_value(found: list, cond: Any) -> bool:
    candidates = _candidates(found)
    if isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond):
        for op, arg in cond.items():
            if op in ("$gt", "$gte", "$lt", "$lte"):
                if not any(_compare(c, op, arg) for c in candidates):
                    return False
            elif op == "$in":
                if not any(c in arg for c in candidates):
                    return False
            elif op == "$nin":
                if any(c in arg for c in candidates):
                    return False
            elif op == "$ne":
                if any(c == arg for c in candidates):
                    return False
            elif op == "$exists":
                if bool(found) != bool(arg):
                    return False
            elif op == "$type":
                if arg != "string":
                    raise AssertionError("FakeDb only implements $type: 'string'")
                if not any(isinstance(c, str) for c in candidates):
                    return False
            else:
                raise AssertionError(f"FakeDb does not support {op}")
        return True
    if not found:
        return cond is None
    return any(c == cond for c in candidates)


def matches(doc: dict, flt: dict) -> bool:
    for key, cond in flt.items():
        if key == "$or":
            if not any(matches(doc, sub) for sub in cond):
                return False
        elif key == "$and":
            if not all(matches(doc, sub) for sub in cond):
                return False
        elif not _match_value(_resolve(doc, key), cond):
            return False
    return True


def _positional_index(doc: dict, flt: dict, array_path: str) -> int:
    array = _resolve(doc, array_path)
    items = array[0] if array else []
    prefix = array_path + "."
    for index, element in enumerate(items):
        ok = True
        for key, cond in flt.items():
            if key.startswith(prefix):
                sub = key[len(prefix):]
                if not _match_value(_resolve({"x": element}, "x." + sub), cond):
                    ok = False
        if ok:
            return index
    raise AssertionError("positional $ used without a matching array element in the filter")


class _Cursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    def __aiter__(self):
        async def gen():
            for d in self._docs:
                yield d

        return gen()

    def sort(self, key_or_list, direction: int = 1):
        """``sort("created_at", -1)`` or ``sort([("updated_at", 1), ("_id", 1)])``; documents lacking a key sort first."""
        keys = [(key_or_list, direction)] if isinstance(key_or_list, str) else list(key_or_list)
        for key, way in reversed(keys):  # stable sorts, least significant key first
            self._docs.sort(key=lambda d, k=key: (1, d[k]) if k in d else (0, 0), reverse=way < 0)
        return self

    def limit(self, n: int):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: int | None = None):
        return self._docs if length is None else self._docs[:length]


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []
        # Partial unique indexes: each entry is a tuple of keys; a document is indexed only if it has ALL of them
        # with a non-None value (like ``partialFilterExpression: {client_id: {$type: "string"}}``).
        self.unique: list[tuple[str, ...]] = []

    def _violates_unique(self, doc: dict) -> bool:
        for keys in self.unique:
            if any(doc.get(k) is None for k in keys):
                continue
            if any(all(d.get(k) == doc[k] for k in keys) for d in self.docs):
                return True
        return False

    async def insert_one(self, doc: dict):
        from bson import ObjectId  # real MongoDB assigns an ObjectId, so the fake does too

        doc = copy.deepcopy(doc)
        doc.setdefault("_id", ObjectId())
        if any(d["_id"] == doc["_id"] for d in self.docs) or self._violates_unique(doc):
            raise DuplicateKeyError("E11000 duplicate key error")
        self.docs.append(doc)
        return SimpleNamespace(inserted_id=doc["_id"])

    def _find(self, flt: dict) -> dict | None:
        return next((d for d in self.docs if matches(d, flt)), None)

    async def find_one(self, flt: dict | None = None, projection: dict | None = None):
        found = self._find(flt or {})
        return copy.deepcopy(found) if found else None

    @staticmethod
    def _apply(doc: dict, update: dict, flt: dict) -> None:
        for key, value in update.get("$set", {}).items():
            if key.endswith(".$"):
                array_path = key[:-2]
                index = _positional_index(doc, flt, array_path)
                doc[array_path][index] = copy.deepcopy(value)
            else:
                doc[key] = copy.deepcopy(value)
        for key, value in update.get("$inc", {}).items():
            doc[key] = doc.get(key, 0) + value
        for key in update.get("$unset", {}):
            doc.pop(key, None)
        for key, value in update.get("$push", {}).items():
            doc.setdefault(key, []).append(copy.deepcopy(value))
        for key, cond in update.get("$pull", {}).items():
            kept = []
            for element in doc.get(key, []):
                if isinstance(cond, dict) and isinstance(element, dict):
                    hit = all(element.get(k) == v for k, v in cond.items())
                else:
                    hit = element == cond
                if not hit:
                    kept.append(element)
            if key in doc:
                doc[key] = kept

    def _update(self, found: dict, update: dict, flt: dict) -> bool:
        before = copy.deepcopy(found)
        self._apply(found, update, flt)
        return found != before

    async def find_one_and_update(self, flt: dict, update: dict):
        found = self._find(flt)
        if not found:
            return None
        before = copy.deepcopy(found)
        self._apply(found, update, flt)
        return before

    async def find_one_and_delete(self, flt: dict):
        found = self._find(flt)
        if not found:
            return None
        self.docs.remove(found)
        return copy.deepcopy(found)

    async def update_one(self, flt: dict, update: dict, upsert: bool = False):
        found = self._find(flt)
        if found:
            changed = self._update(found, update, flt)
            return SimpleNamespace(matched_count=1, modified_count=1 if changed else 0, upserted_id=None)
        if upsert:
            doc = {k: v for k, v in flt.items() if not k.startswith("$")}
            self._apply(doc, update, flt)
            doc.setdefault("_id", object())
            self.docs.append(doc)
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=doc["_id"])
        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    async def update_many(self, flt: dict, update: dict):
        matched = [d for d in self.docs if matches(d, flt)]
        modified = sum(1 for d in matched if self._update(d, update, flt))
        return SimpleNamespace(matched_count=len(matched), modified_count=modified)

    async def delete_many(self, flt: dict):
        keep = [d for d in self.docs if not matches(d, flt)]
        n = len(self.docs) - len(keep)
        self.docs = keep
        return SimpleNamespace(deleted_count=n)

    async def delete_one(self, flt: dict):
        found = self._find(flt)
        if found:
            self.docs.remove(found)
        return SimpleNamespace(deleted_count=1 if found else 0)

    async def count_documents(self, flt: dict):
        return sum(1 for d in self.docs if matches(d, flt))

    async def distinct(self, key: str, flt: dict | None = None):
        out: list = []
        for d in self.docs:
            if matches(d, flt or {}) and key in d and d[key] not in out:
                out.append(d[key])
        return out

    def find(self, flt: dict | None = None, projection: dict | None = None):
        return _Cursor([copy.deepcopy(d) for d in self.docs if matches(d, flt or {})])


class FakeDb:
    def __init__(self) -> None:
        self._c: dict[str, FakeCollection] = {}

    # The unique indexes that app/db/indexes.py creates in a real database (partial: only documents with all keys).
    UNIQUE = {"tasks": [("user_id", "client_id")], "users": [("email",)]}

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._c:
            collection = FakeCollection()
            collection.unique = list(self.UNIQUE.get(name, []))
            self._c[name] = collection
        return self._c[name]


def naive(dt):
    return dt.replace(tzinfo=None)
