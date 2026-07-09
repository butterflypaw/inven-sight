"""
Seed scan_history records from April 1 to May 6, 2026.

Confidence distribution (stored as percentage 0-100):
  Apr  1-19 : 80-88  (moderate-high)
  Apr 20-30 : 88-96  (high)
  May  1-6  : 90-100 (peak)

Run from project root:
  python backend/seed_heatmap_data.py
"""

import random
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB_NAME = "invensight"

WAREHOUSES = [
    "Warehouse A", "Warehouse B", "Warehouse C",
    "Warehouse D", "Warehouse E", "Warehouse F",
    "Warehouse G", "Warehouse H",
]

# (productName, sku) pairs matching the style used by make_entry / scan_history.json
PRODUCTS = [
    ("Wireless Mouse",       "MOU-101"),
    ("Mechanical Keyboard",  "KEY-202"),
    ("HD Monitor",           "MON-303"),
    ("USB Webcam",           "CAM-404"),
    ("Laptop Stand",         "STD-505"),
    ("Ethernet Cable",       "ETH-606"),
    ("HDMI Adapter",         "ADP-707"),
    ("SSD Drive",            "SSD-808"),
    ("Power Strip",          "PWR-909"),
    ("Docking Station",      "DOC-010"),
    ("Noise-Cancel Headset", "HDN-111"),
    ("Portable Charger",     "CHR-212"),
    ("Bluetooth Speaker",    "SPK-313"),
    ("External Hard Drive",  "HDD-414"),
    ("Smart Hub",            "HUB-515"),
]


def _confidence_range(date: datetime) -> tuple[float, float]:
    """Confidence bounds (percentage) for a given date."""
    if date.month == 5:
        return (90.0, 100.0)
    if date.month == 4 and date.day >= 20:
        return (88.0, 96.0)
    return (80.0, 88.0)


def _scans_per_day(date: datetime) -> int:
    """More scans toward late April / early May for heatmap density."""
    if date.month == 5:
        return random.randint(7, 14)
    if date.month == 4 and date.day >= 20:
        return random.randint(6, 11)
    if date.month == 4 and date.day >= 10:
        return random.randint(4, 8)
    return random.randint(2, 5)


def _make_record(next_id: int, date: datetime) -> dict:
    lo, hi = _confidence_range(date)
    confidence = round(random.uniform(lo, hi), 2)

    # Higher confidence → more likely intact; lower end → slightly more damage
    damaged_prob = max(0.05, 0.5 - (confidence - 80) / 40)
    damage = "damaged" if random.random() < damaged_prob else "intact"

    product_name, sku = random.choice(PRODUCTS)
    hour = random.randint(6, 20)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    ts = date.replace(hour=hour, minute=minute, second=second, tzinfo=timezone.utc)

    return {
        "id": next_id,
        "productName": product_name,
        "itemId": product_name,
        "sku": sku,
        "damage": damage,
        "confidence": confidence,        # percentage, e.g. 93.47
        "shippedFrom": random.choice(WAREHOUSES),
        "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "filename": f"seed_{next_id:05d}.jpg",
        "imageUrl": "",
        "previewImageUrl": "",
        "imageHash": "",
        "seeded": True,
    }


def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    db = client[MONGO_DB_NAME]
    col = db["scan_history"]

    # Continue id sequence from the current max
    last = col.find_one(sort=[("id", -1)])
    next_id = (last["id"] + 1) if last and isinstance(last.get("id"), int) else 1

    start = datetime(2026, 4, 1)
    end   = datetime(2026, 5, 6)

    records = []
    current = start
    while current <= end:
        for _ in range(_scans_per_day(current)):
            records.append(_make_record(next_id, current))
            next_id += 1
        current += timedelta(days=1)

    col.insert_many(records)
    print(f"Inserted {len(records)} records  ({start.date()} → {end.date()})")

    # Summary breakdown
    def _avg(lst):
        return round(sum(r["confidence"] for r in lst) / len(lst), 1) if lst else 0

    def _parse_month_day(r):
        dt = datetime.strptime(r["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
        return dt.month, dt.day

    early    = [r for r in records if _parse_month_day(r) < (4, 20)]
    late_apr = [r for r in records if (4, 20) <= _parse_month_day(r) <= (4, 30)]
    may      = [r for r in records if _parse_month_day(r)[0] == 5]

    print(f"  Apr  1-19 : {len(early):4d} records  avg confidence {_avg(early):.1f}%")
    print(f"  Apr 20-30 : {len(late_apr):4d} records  avg confidence {_avg(late_apr):.1f}%")
    print(f"  May  1-6  : {len(may):4d} records  avg confidence {_avg(may):.1f}%")
    print(f"  Damaged   : {sum(1 for r in records if r['damage'] == 'damaged')}")
    print(f"  Intact    : {sum(1 for r in records if r['damage'] == 'intact')}")


if __name__ == "__main__":
    main()
