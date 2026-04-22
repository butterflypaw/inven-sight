import json
import os
from pathlib import Path

try:
    import tensorflow as tf
    from tensorflow.keras.preprocessing.image import img_to_array
    TF_AVAILABLE = True
except Exception as err:
    tf = None
    img_to_array = None
    TF_AVAILABLE = False
    print("TensorFlow import failed:", str(err))

DEFAULT_CLASS_NAMES = ["damaged", "intact"]
MODEL_DIR = Path(__file__).resolve().parent
METADATA_PATH = MODEL_DIR / "training_metadata.json"

MODEL_PATH_CANDIDATES = [
    os.getenv("MODEL_PATH"),
    str(MODEL_DIR / "model_best.keras"),
    str(MODEL_DIR / "model_final.h5"),
    str(MODEL_DIR / "model_best.h5"),
    str(MODEL_DIR / "resnet34_model.h5"),
]

model = None
model_input_size = (256, 256)
class_names = DEFAULT_CLASS_NAMES
use_external_normalization = True


def _load_metadata():
    global class_names

    if not METADATA_PATH.exists():
        return

    try:
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        loaded_classes = metadata.get("class_names")
        if isinstance(loaded_classes, list) and len(loaded_classes) >= 2:
            class_names = loaded_classes
    except Exception as err:
        print("Failed to parse metadata:", str(err))


def _infer_input_size(loaded_model):
    shape = loaded_model.input_shape
    if isinstance(shape, list):
        shape = shape[0]
    if isinstance(shape, tuple) and len(shape) >= 3:
        h, w = shape[1], shape[2]
        if isinstance(h, int) and isinstance(w, int):
            return (w, h)
    return (256, 256)


def _should_normalize_outside_model(loaded_model):
    if not loaded_model.layers:
        return True
    first_layer = loaded_model.layers[0].__class__.__name__.lower()
    return first_layer != "rescaling"


def _load_model_once():
    global model, model_input_size, use_external_normalization

    if model is not None:
        return

    if not TF_AVAILABLE:
        return

    _load_metadata()

    resolved_path = None
    for candidate in MODEL_PATH_CANDIDATES:
        if candidate and Path(candidate).exists():
            resolved_path = candidate
            break

    if not resolved_path:
        print("No model file found. Train a model and place it in backend/model.")
        return

    model = tf.keras.models.load_model(resolved_path)
    model_input_size = _infer_input_size(model)
    use_external_normalization = _should_normalize_outside_model(model)
    print("Loaded model:", resolved_path)
    print("Inference size:", model_input_size)
    print("Classes:", class_names)


def preprocess_image(image):
    if not TF_AVAILABLE:
        raise RuntimeError("TensorFlow is not installed in this Python environment.")

    image = image.resize(model_input_size)
    image = img_to_array(image)
    image = tf.convert_to_tensor(image, dtype=tf.float32)
    image = tf.expand_dims(image, axis=0)
    if use_external_normalization:
        image = image / 255.0
    return image


def _parse_prediction(prediction):
    if isinstance(prediction, (list, tuple)):
        flat = list(prediction)
    else:
        flat = [float(prediction)] if prediction is not None else []

    if len(flat) == 1:
        prob_intact = float(flat[0])
        prob_intact = min(max(prob_intact, 0.0), 1.0)
        label = class_names[1] if prob_intact >= 0.5 else class_names[0]
        confidence = prob_intact if prob_intact >= 0.5 else 1.0 - prob_intact
        return label, confidence

    label_index = max(range(len(flat)), key=lambda idx: flat[idx]) if flat else 0
    confidence = float(flat[label_index]) if flat else 0.0
    if label_index < len(class_names):
        label = class_names[label_index]
    else:
        label = str(label_index)
    return label, confidence


def predict(pil_image):
    try:
        if not TF_AVAILABLE:
            return {
                "error": "TensorFlow is not installed. Install backend requirements and retrain or load a model.",
            }

        _load_model_once()
        if model is None:
            return {
                "error": "Model is not available. Run training first and place the model file in backend/model.",
            }

        processed = preprocess_image(pil_image)
        raw = model.predict(processed, verbose=0)
        label, confidence = _parse_prediction(raw[0])

        return {"label": label, "confidence": round(float(confidence), 4)}
    except Exception as err:
        print("Prediction error:", str(err))
        return {"error": str(err)}
