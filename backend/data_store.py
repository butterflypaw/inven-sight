import random
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from pymongo import MongoClient
from werkzeug.security import check_password_hash, generate_password_hash

MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB_NAME = "invensight"

WAREHOUSE_POOL = [
    "Warehouse A",
    "Warehouse B",
    "Warehouse C",
    "Warehouse D",
    "Warehouse E",
    "Warehouse F",
    "Warehouse G",
    "Warehouse H",
]

DATASET_DIR = Path(__file__).resolve().parent / "dataset"
DAMAGED_DIR = DATASET_DIR / "damaged"
INTACT_DIR = DATASET_DIR / "intact"

_mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
_db = _mongo_client[MONGO_DB_NAME]
_history_col = _db["scan_history"]
_inventory_col = _db["inventory"]
_users_col = _db["users"]

DEFAULT_HISTORY = [
    {"id": 1, "productName": "BOX-0001", "sku": "BX-0001", "damage": "intact", "confidence": 96.2, "shippedFrom": "Warehouse A", "timestamp": "2026-04-22T06:01:00Z", "filename": "init1.jpg"},
    {"id": 2, "productName": "BOX-0002", "sku": "BX-0002", "damage": "damaged", "confidence": 81.7, "shippedFrom": "Warehouse B", "timestamp": "2026-04-22T06:04:00Z", "filename": "init2.jpg"},
    {"id": 3, "productName": "BOX-0003", "sku": "BX-0003", "damage": "intact", "confidence": 93.1, "shippedFrom": "Warehouse C", "timestamp": "2026-04-22T06:06:00Z", "filename": "init3.jpg"},
    {"id": 4, "productName": "BOX-0004", "sku": "BX-0004", "damage": "damaged", "confidence": 74.8, "shippedFrom": "Warehouse D", "timestamp": "2026-04-22T06:08:00Z", "filename": "init4.jpg"},
    {"id": 5, "productName": "BOX-0005", "sku": "BX-0005", "damage": "intact", "confidence": 91.4, "shippedFrom": "Warehouse A", "timestamp": "2026-04-22T06:10:00Z", "filename": "init5.jpg"},
    {"id": 6, "productName": "BOX-0006", "sku": "BX-0006", "damage": "damaged", "confidence": 69.5, "shippedFrom": "Warehouse B", "timestamp": "2026-04-22T06:13:00Z", "filename": "init6.jpg"},
]

DEFAULT_INVENTORY = [
    {"sku": "BX-0001", "name": "BOX-0001", "warehouse": "Warehouse A", "stock": 44, "reserved": 8, "damageRisk": "Low"},
    {"sku": "BX-0002", "name": "BOX-0002", "warehouse": "Warehouse B", "stock": 21, "reserved": 12, "damageRisk": "Medium"},
    {"sku": "BX-0003", "name": "BOX-0003", "warehouse": "Warehouse C", "stock": 9, "reserved": 6, "damageRisk": "High"},
    {"sku": "BX-0004", "name": "BOX-0004", "warehouse": "Warehouse D", "stock": 67, "reserved": 11, "damageRisk": "Low"},
    {"sku": "BX-0005", "name": "BOX-0005", "warehouse": "Warehouse A", "stock": 12, "reserved": 5, "damageRisk": "Medium"},
    {"sku": "BX-0006", "name": "BOX-0006", "warehouse": "Warehouse B", "stock": 6, "reserved": 4, "damageRisk": "High"},
]


def dataset_image_for_label(label):
    target_dir = DAMAGED_DIR if str(label).lower() == "damaged" else INTACT_DIR
    if not target_dir.exists():
        return ""

    files = [f for f in target_dir.iterdir() if f.is_file()]
    if not files:
        return ""

    picked = random.choice(files)
    return f"/dataset/{target_dir.name}/{picked.name}"


def _seed_collections_if_empty():
    if _history_col.count_documents({}) == 0:
        seeded_history = []
        for row in DEFAULT_HISTORY:
            clone = dict(row)
            clone["imageUrl"] = dataset_image_for_label(clone.get("damage", "intact"))
            seeded_history.append(clone)
        _history_col.insert_many(seeded_history)

    if _inventory_col.count_documents({}) == 0:
        seeded_inventory = []
        for row in DEFAULT_INVENTORY:
            clone = dict(row)
            clone["imageUrl"] = dataset_image_for_label("damaged" if clone.get("damageRisk") == "High" else "intact")
            seeded_inventory.append(clone)
        _inventory_col.insert_many(seeded_inventory)


def _strip_mongo_id(rows):
    cleaned = []
    for row in rows:
        clone = dict(row)
        clone.pop("_id", None)
        cleaned.append(clone)
    return cleaned


def _normalize_inventory_row(row, index=1):
    clone = dict(row)
    clone.pop("_id", None)
    item_id = clone.get("itemId") or clone.get("name") or clone.get("productName") or clone.get("sku") or f"INV-{index:08d}"
    if not str(item_id).upper().startswith("INV-"):
        item_id = f"INV-{index:08d}"
    clone["itemId"] = item_id
    clone["productName"] = item_id
    clone["name"] = item_id
    clone["sku"] = clone.get("sku") or f"SKU-{index:08d}"
    clone["quantity"] = int(clone.get("quantity") or clone.get("stock") or 1)
    clone["damageRisk"] = clone.get("damageRisk") or ("Low" if str(clone.get("damage", "intact")).lower() == "intact" else "High")
    clone.setdefault("status", clone.get("damage", "intact"))
    clone["warehouse"] = clone.get("warehouse") or clone.get("shippedFrom") or random.choice(WAREHOUSE_POOL)
    scan_image = str(clone.get("imageUrl") or "").strip()
    if scan_image:
        clone["previewImageUrl"] = scan_image
    else:
        fallback = clone.get("previewImageUrl") or dataset_image_for_label(
            "damaged" if str(clone.get("damageRisk", "")).lower() == "high" else "intact"
        )
        clone["previewImageUrl"] = fallback
        clone["imageUrl"] = fallback
    return clone


def _normalize_item_id(candidate, next_id):
    value = str(candidate or "").strip().upper()
    if value:
        normalized = re.sub(r"[^A-Z0-9-]", "", value)
        if normalized and normalized.startswith("INV-"):
            return normalized
    return f"INV-{next_id:08d}"


def _normalize_sku(candidate, item_id, next_id):
    value = str(candidate or "").strip().upper()
    if value:
        cleaned = re.sub(r"[^A-Z0-9-]", "", value)
        if cleaned:
            return cleaned
    return f"SKU-{next_id:08d}"


def _resolve_warehouse(location):
    # Warehouse assignment is randomized on each scan to simulate distributed intake lanes.
    return random.choice(WAREHOUSE_POOL)


def read_history():
    try:
        _mongo_client.admin.command("ping")
        _seed_collections_if_empty()
        rows = list(_history_col.find({}, {"_id": 0}).sort("id", 1))
        for row in rows:
            scan_image = str(row.get("imageUrl") or "").strip()
            if scan_image:
                row["previewImageUrl"] = scan_image
            else:
                fallback = row.get("previewImageUrl") or dataset_image_for_label(row.get("damage", "intact"))
                row["previewImageUrl"] = fallback
                row["imageUrl"] = fallback
        return _strip_mongo_id(rows)
    except Exception:
        seeded = []
        for row in DEFAULT_HISTORY:
            clone = dict(row)
            clone["imageUrl"] = dataset_image_for_label(clone.get("damage", "intact"))
            seeded.append(clone)
        return seeded


def read_inventory():
    try:
        _mongo_client.admin.command("ping")
        _seed_collections_if_empty()
        rows = list(_inventory_col.find({}, {"_id": 0}))
        normalized_rows = [_normalize_inventory_row(row, idx + 1) for idx, row in enumerate(rows)]
        return _strip_mongo_id(normalized_rows)
    except Exception:
        seeded = []
        for idx, row in enumerate(DEFAULT_INVENTORY, start=1):
            clone = _normalize_inventory_row(row, idx)
            clone["imageUrl"] = dataset_image_for_label("damaged" if clone.get("damageRisk") == "High" else "intact")
            seeded.append(clone)
        return seeded


def append_inventory(entry):
    _mongo_client.admin.command("ping")
    rows = read_inventory()
    next_id = (rows[-1].get("id", 0) + 1) if rows else 1
    item_id = _normalize_item_id(entry.get("itemId") or entry.get("productName"), next_id)
    barcode = _normalize_sku(entry.get("sku"), item_id, next_id)
    existing = next((row for row in rows if str(row.get("sku", "")).strip() == barcode), None)

    if existing:
        new_quantity = int(existing.get("quantity") or existing.get("stock") or 1) + 1
        _inventory_col.update_one(
            {"sku": barcode},
            {
                "$set": {
                    "itemId": existing.get("itemId") or item_id,
                    "productName": existing.get("itemId") or item_id,
                    "name": existing.get("itemId") or item_id,
                    "warehouse": entry.get("shippedFrom") or entry.get("location") or existing.get("warehouse") or _resolve_warehouse(""),
                    "quantity": new_quantity,
                    "damageRisk": "High" if str(entry.get("damage", "")).lower() == "damaged" else existing.get("damageRisk", "Low"),
                    "status": entry.get("damage") or existing.get("status", "intact"),
                    "confidence": entry.get("confidence", existing.get("confidence")),
                    "timestamp": entry.get("timestamp", existing.get("timestamp")),
                    "imageUrl": entry.get("imageUrl") or existing.get("imageUrl", ""),
                    "previewImageUrl": entry.get("previewImageUrl") or existing.get("previewImageUrl") or dataset_image_for_label(entry.get("damage", "intact")),
                }
            },
        )
        return

    inventory_entry = {
        "id": next_id,
        "itemId": item_id,
        "sku": barcode,
        "productName": item_id,
        "name": item_id,
        "warehouse": entry.get("shippedFrom") or entry.get("location") or _resolve_warehouse(""),
        "quantity": 1,
        "damageRisk": "High" if str(entry.get("damage", "")).lower() == "damaged" else "Low",
        "status": entry.get("damage") or "intact",
        "confidence": entry.get("confidence"),
        "timestamp": entry.get("timestamp"),
        "imageUrl": entry.get("imageUrl", ""),
        "previewImageUrl": entry.get("previewImageUrl") or dataset_image_for_label(entry.get("damage", "intact")),
    }
    _inventory_col.insert_one(dict(inventory_entry))


def append_history(entry):
    _mongo_client.admin.command("ping")
    _history_col.insert_one(dict(entry))


def has_recent_duplicate(image_hash: str, within_seconds: int = 20) -> bool:
    if not image_hash:
        return False

    _mongo_client.admin.command("ping")
    row = _history_col.find_one({"imageHash": image_hash}, sort=[("id", -1)])
    if not row:
        return False

    ts = row.get("timestamp", "")
    try:
        last_time = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except Exception:
        return True

    now = datetime.utcnow().replace(tzinfo=last_time.tzinfo)
    age = (now - last_time).total_seconds()
    return age <= within_seconds


def make_entry(label, confidence, filename, image_url="", product_name="", sku="", location="", image_hash: Optional[str] = None):
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    rows = read_history()
    next_id = (rows[-1].get("id", 0) + 1) if rows else 1
    item_id = _normalize_item_id(product_name, next_id)
    normalized_sku = _normalize_sku(sku, item_id, next_id)
    return {
        "id": next_id,
        "productName": item_id,
        "itemId": item_id,
        "sku": normalized_sku,
        "damage": (label or "unknown").lower(),
        "confidence": round(float(confidence or 0) * 100, 2),
        "shippedFrom": _resolve_warehouse(location),
        "timestamp": now,
        "filename": filename or "capture.jpg",
        "imageUrl": image_url,
        "previewImageUrl": image_url,
        "imageHash": image_hash or "",
    }


def create_user(username, password):
    _mongo_client.admin.command("ping")
    normalized_username = str(username or "").strip().lower()
    if not normalized_username:
        raise ValueError("Username is required")
    if len(str(password or "")) < 6:
        raise ValueError("Password must be at least 6 characters")

    existing = _users_col.find_one({"username": normalized_username})
    if existing:
        raise ValueError("Username already exists")

    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    _users_col.insert_one(
        {
            "username": normalized_username,
            "passwordHash": generate_password_hash(password),
            "createdAt": now,
        }
    )
    return {"username": normalized_username, "createdAt": now}


def authenticate_user(username, password):
    _mongo_client.admin.command("ping")
    normalized_username = str(username or "").strip().lower()
    account = _users_col.find_one({"username": normalized_username})
    if not account:
        return None

    if not check_password_hash(account.get("passwordHash", ""), str(password or "")):
        return None

    return {
        "username": account.get("username"),
        "createdAt": account.get("createdAt"),
    }
