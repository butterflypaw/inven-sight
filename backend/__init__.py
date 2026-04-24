from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS
from routes.predict import predict_bp
from routes.data_api import data_bp
from routes.auth_api import auth_bp

def create_app():
    app = Flask(__name__)
    uploads_dir = Path(__file__).resolve().parent / "uploads"
    dataset_dir = Path(__file__).resolve().parent / "dataset"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    CORS(app,
         origins=["*"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization"]
    )
    app.register_blueprint(predict_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(auth_bp)

    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(str(uploads_dir), filename)

    @app.route("/dataset/<path:subpath>")
    def serve_dataset(subpath):
        return send_from_directory(str(dataset_dir), subpath)

    return app
