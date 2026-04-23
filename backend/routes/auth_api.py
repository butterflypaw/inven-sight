from flask import Blueprint, jsonify, request

from data_store import authenticate_user, create_user

auth_bp = Blueprint("auth_bp", __name__)


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "")
    password = payload.get("password", "")

    try:
        user = create_user(username=username, password=password)
        return jsonify({"message": "User registered", "user": user}), 201
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": str(err)}), 500


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "")
    password = payload.get("password", "")

    try:
        user = authenticate_user(username=username, password=password)
        if not user:
            return jsonify({"error": "Invalid username or password"}), 401
        return jsonify({"message": "Login successful", "user": user})
    except Exception as err:
        return jsonify({"error": str(err)}), 500
