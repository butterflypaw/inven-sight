from pathlib import Path
from uuid import uuid4

from flask import Blueprint, request, jsonify
from PIL import Image
from werkzeug.utils import secure_filename

from model.model import predict
from data_store import append_history, append_inventory, dataset_image_for_label, make_entry

predict_bp = Blueprint('predict_bp', __name__)

@predict_bp.route("/predict", methods=["POST"])
def predict_route():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    try:
        sku = request.form.get("sku", "")
        product_name = request.form.get("product_name", "")
        location = request.form.get("location", "")

        safe_name = secure_filename(file.filename or "scan.jpg")
        extension = Path(safe_name).suffix.lower() or ".jpg"
        uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"scan_{uuid4().hex}{extension}"
        stored_path = uploads_dir / stored_name
        file.save(stored_path)

        image_url = f"/uploads/{stored_name}"

        image = Image.open(stored_path).convert("RGB")

        result = predict(image)
        if result.get("error"):
            return jsonify(result), 503

        entry = make_entry(
            label=result.get("label"),
            confidence=result.get("confidence"),
            filename=safe_name,
            image_url=image_url,
            product_name=product_name,
            sku=sku,
            location=location,
        )
        append_history(entry)
        append_inventory({
            **entry,
            "imageUrl": entry.get("imageUrl") or dataset_image_for_label(result.get("label")),
        })

        result["entry"] = entry

        return jsonify(result)
    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({"error": str(e)}), 500

