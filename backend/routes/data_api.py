from flask import Blueprint, jsonify

from data_store import read_history, read_inventory

data_bp = Blueprint("data_bp", __name__)


@data_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@data_bp.route("/details", methods=["GET"])
def details():
    rows = read_history()
    ordered = sorted(rows, key=lambda x: x.get("id", 0), reverse=True)
    return jsonify(ordered)


@data_bp.route("/dashboard", methods=["GET"])
def dashboard():
    rows = read_history()
    total_scanned = len(rows)
    damaged_count = sum(1 for item in rows if str(item.get("damage", "")).lower() == "damaged")
    return jsonify({"totalScanned": total_scanned, "damagedCount": damaged_count})


@data_bp.route("/inventory", methods=["GET"])
def inventory():
    rows = read_inventory()
    return jsonify(rows)
