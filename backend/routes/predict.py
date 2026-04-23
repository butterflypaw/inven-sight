from pathlib import Path
from uuid import uuid4
from io import BytesIO
import hashlib

from flask import Blueprint, request, jsonify
from PIL import Image
from werkzeug.utils import secure_filename

from model.model import predict
from data_store import append_history, append_inventory, make_entry, has_recent_duplicate

predict_bp = Blueprint('predict_bp', __name__)


def _load_uploaded_image(file, persist=False):
    safe_name = secure_filename(file.filename or "scan.jpg")
    payload = file.read()
    file_hash = hashlib.sha256(payload).hexdigest() if payload else ""

    if persist:
        extension = Path(safe_name).suffix.lower() or ".jpg"
        uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"scan_{uuid4().hex}{extension}"
        stored_path = uploads_dir / stored_name
        with open(stored_path, "wb") as output:
            output.write(payload)
        image_url = f"/uploads/{stored_name}"
        image = Image.open(stored_path).convert("RGB")
        return image, safe_name, image_url, file_hash

    image = Image.open(BytesIO(payload)).convert("RGB")
    return image, safe_name, "", file_hash


@predict_bp.route("/predict-frame", methods=["POST"])
def predict_frame_route():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    try:
        image, _, _, _ = _load_uploaded_image(file, persist=False)
        result = predict(image)
        if result.get("error"):
            return jsonify(result), 503
        if result.get("rejected_input"):
            return jsonify(result), 422
        return jsonify(result)
    except Exception as e:
        print("Frame prediction error:", str(e))
        return jsonify({"error": str(e)}), 500

@predict_bp.route("/predict", methods=["POST"])
def predict_route():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    try:
        sku = request.form.get("sku", "")
        product_name = request.form.get("product_name", "")
        location = request.form.get("location", "")

        image, safe_name, image_url, image_hash = _load_uploaded_image(file, persist=True)

        result = predict(image)
        if result.get("error"):
            return jsonify(result), 503
        if result.get("rejected_input"):
            return jsonify(result), 422

        if has_recent_duplicate(image_hash):
            return jsonify({
                "label": result.get("label"),
                "confidence": result.get("confidence"),
                "duplicate": True,
                "message": "Duplicate scan skipped for the same item.",
            })

        entry = make_entry(
            label=result.get("label"),
            confidence=result.get("confidence"),
            filename=safe_name,
            image_url=image_url,
            product_name=product_name,
            sku=sku,
            location=location,
            image_hash=image_hash,
        )
        append_history(entry)
        append_inventory({
            **entry,
            "imageUrl": entry.get("imageUrl"),
            "previewImageUrl": entry.get("previewImageUrl"),
        })

        result["entry"] = entry

        return jsonify(result)
    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({"error": str(e)}), 500

