import tensorflow as tf
import numpy as np
import cv2

IMG_SIZE = (256, 256)
CLASS_NAMES = ['intact', 'damaged']
MODEL_PATH = "model/model.h5"

model = tf.keras.models.load_model(MODEL_PATH)
human_detector = None
face_detector = None

PACKAGE_KEYWORDS = {
    "carton",
    "crate",
    "packet",
    "envelope",
    "parcel",
    "package",
    "box",
}

HUMAN_KEYWORDS = {
    "person",
    "face",
    "head",
    "beard",
    "wig",
    "hair",
    "mask",
    "sunglass",
    "lip",
    "nose",
    "eye",
}

try:
    human_detector = tf.keras.applications.MobileNetV2(weights="imagenet")
except Exception as exc:
    # Human guard is optional; prediction still works if ImageNet weights cannot be loaded.
    print("Human detector unavailable:", str(exc))

try:
    face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if face_detector.empty():
        face_detector = None
except Exception as exc:
    print("Face detector unavailable:", str(exc))

def preprocess_image(image):
    image = image.resize(IMG_SIZE)
    image = tf.keras.preprocessing.image.img_to_array(image)
    image = tf.convert_to_tensor(image, dtype=tf.float32)
    image = tf.expand_dims(image, axis=0)  
    image = image / 255.0                  
    return image


def _decode_scene(pil_image, top=5):
    if human_detector is None:
        return []

    resized = pil_image.resize((224, 224))
    arr = tf.keras.preprocessing.image.img_to_array(resized)
    arr = np.expand_dims(arr, axis=0)
    arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)
    preds = human_detector.predict(arr, verbose=0)
    return tf.keras.applications.mobilenet_v2.decode_predictions(preds, top=top)[0]


def detect_human(decoded_scene):
    if not decoded_scene:
        return False, 0.0

    top_human = 0.0
    for _, class_name, score in decoded_scene:
        lowered = class_name.lower()
        if any(keyword in lowered for keyword in HUMAN_KEYWORDS):
            top_human = max(top_human, float(score))
    return top_human >= 0.18, top_human


def detect_non_package(decoded_scene):
    # Strict gate: run model.h5 only when scene pre-check looks like package/box.
    if not decoded_scene:
        return True, 0.0, "unknown"

    package_candidates = []
    for _, class_name, score in decoded_scene:
        lowered = class_name.lower()
        if any(keyword in lowered for keyword in PACKAGE_KEYWORDS):
            package_candidates.append((class_name, float(score)))

    if not package_candidates:
        best_name = decoded_scene[0][1]
        best_score = float(decoded_scene[0][2])
        return True, best_score, best_name

    best_package_name, best_package_score = max(package_candidates, key=lambda item: item[1])
    if best_package_score < 0.08:
        return True, best_package_score, best_package_name

    return False, best_package_score, best_package_name


def detect_face(pil_image):
    if face_detector is None:
        return False, 0

    rgb_array = np.array(pil_image)
    if rgb_array.size == 0:
        return False, 0

    gray = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2GRAY)
    faces = face_detector.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(40, 40),
    )
    return len(faces) > 0, len(faces)
    
def predict(pil_image):
    try:
        has_face, face_count = detect_face(pil_image)
        if has_face:
            return {
                "label": "human",
                "confidence": 1.0 if face_count else 0.0,
                "rejected_input": True,
                "message": "This is not a package or box. Human/face detected.",
            }

        decoded_scene = _decode_scene(pil_image)

        is_human, human_score = detect_human(decoded_scene)
        if is_human:
            return {
                "label": "human",
                "confidence": round(human_score, 4),
                "rejected_input": True,
                "message": "This is not a package or box. Human/face detected.",
            }

        is_non_package, non_package_score, detected_label = detect_non_package(decoded_scene)
        if is_non_package:
            return {
                "label": "not_package",
                "confidence": round(non_package_score, 4),
                "rejected_input": True,
                "message": f"This is not a package or box ({detected_label}). Please scan only packaged boxes.",
            }

        processed = preprocess_image(pil_image)
        prediction = model.predict(processed, verbose=0)[0]
        print("Raw model output:", prediction.tolist())

        label_index = np.argmax(prediction)
        label = CLASS_NAMES[label_index]
        confidence = float(np.max(prediction))

        return {"label": label, "confidence": round(confidence, 4)}
    except Exception as e:
        print("Prediction error:", str(e))
        return {"error": str(e)}