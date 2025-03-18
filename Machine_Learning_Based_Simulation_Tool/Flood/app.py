# app.py

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd

# Import the heavy-lifting logic from flood_logic.py
from floodLogic import flood_prediction_logic

def create_app():
    """Factory function to create and configure the Flask app."""
    app = Flask(__name__)

    # Configure CORS (if needed for local dev or specific domains)
    CORS(app, resources={
        r"/*": {
            "origins": "http://localhost:3000",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })

    @app.route("/predict", methods=["GET", "OPTIONS"])
    def get_prediction():
        # Handle the preflight OPTIONS request
        if request.method == "OPTIONS":
            return "", 200

        # Grab date from query parameters
        date_str = request.args.get("date")
        if not date_str:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Call the heavy-lifting logic
        result_dict = flood_prediction_logic(date_str)

        # If there's an error in the logic, result_dict will have {"error": ...}
        if "error" in result_dict:
            return jsonify(result_dict), 400  # or 500, up to you

        return jsonify(result_dict)

    return app


if __name__ == "__main__":
    # Create the app and run
    app = create_app()
    app.run(host="0.0.0.0", port=8000, debug=True)