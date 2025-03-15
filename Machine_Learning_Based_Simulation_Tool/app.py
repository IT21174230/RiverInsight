from flask import Flask, request, jsonify
import atexit
import os
import shutil
from utils.meander_migration import return_to_hp, get_raw_predictions
from utils.meander_migration_xai import send_map_to_api
from utils.com_cache import m_cache, data_cache, init_cache
from utils.riverbank_erosion import load_resources, prepare_future_input, make_predictions
from utils.riverbank_erosion_xai import generate_heatmap_with_timesteps
from flask_cors import CORS

# Flask constructor takes the name of current module (__name__) as argument.
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)
init_cache(app)

# Load resources (model and scalers) globally for riverbank erosion
model, scaler_ts, scaler_year = load_resources()

def clean_up():
    IMAGE_FOLDER = r'data_dir\meander_migration_sal_maps'
    if os.path.exists(IMAGE_FOLDER):
        shutil.rmtree(IMAGE_FOLDER)  
        print(f"Cleared all images in {IMAGE_FOLDER}")
    
    # Clear cache
    m_cache.clear()
    data_cache.clear()
    print("Cleared all cache")
    
atexit.register(clean_up)

# --------------------------------------------------------------------
# Existing routes (meander migration, erosion, etc.) – NOT modified
# --------------------------------------------------------------------
@app.route('/')
def homepage():
    return 'Homepage'

@app.get('/meander_migration/params/')
def predict_meander():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    df = return_to_hp(y, q)
    try:
        return jsonify(df.to_dict(orient="records"))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.get('/meander_migration/params/explain_migration/')
def get_saliency():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    map_idx = int(query['idx'])
    map = send_map_to_api(y, q, map_idx)
    return map

@app.get('/meander_migration/params/get_point_values/')
def get_raw_point_vals():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    raw_df = get_raw_predictions(y, q)
    try:
        return jsonify(raw_df.to_dict(orient="records"))
    except:
        return jsonify(raw_df)

# New route for riverbank erosion prediction
@app.route('/predict_erosion', methods=['POST'])
def predict():
    try:
        # Parse input JSON
        data = request.get_json()
        year = data.get('year')
        quarter = data.get('quarter')

        if year is None or quarter is None:
            return jsonify({'error': 'Missing year or quarter in the request.'}), 400

        # Prepare input features and make predictions
        future_X = prepare_future_input(year, quarter, scaler_year)
        predictions = make_predictions(model, scaler_ts, future_X)

        # Prepare response
        return jsonify({'year': year, 'quarter': quarter, 'predictions': predictions}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route for generating heatmap
@app.route('/predict_erosion/heatmap', methods=['POST'])
def predict_heatmap():
    try:
        # Parse input parameters from JSON body
        request_data = request.get_json()
        if not request_data:
            return jsonify({'error': 'Invalid input, JSON body expected.'}), 400

        start_year = int(request_data['year'])
        start_quarter = int(request_data['quarter'])
        points = list(map(int, request_data.get('points', [])))  # Example: [1, 5, 10, 20]
        timesteps = int(request_data.get('timesteps', 5))  # Default to 5 timesteps if not provided

        # Validate input
        if not points:
            return jsonify({'error': 'Points must be a non-empty list of integers.'}), 400

        # Generate the heatmap
        heatmap_image = generate_heatmap_with_timesteps(model, start_year, start_quarter, scaler_year, points, timesteps)

        # Return the heatmap image as a base64 string
        return jsonify({'heatmap': heatmap_image}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# New route for fetching historical erosion data
@app.route('/predict_erosion/history', methods=['POST'])
def get_erosion_history():
    try:
        # Parse input JSON
        data = request.get_json()
        start_year = data.get('startYear', 2025)  # Default to 2025 if not provided
        start_quarter = data.get('startQuarter', 1)  # Default to Q1 if not provided
        end_year = data.get('endYear')
        end_quarter = data.get('endQuarter')

        if end_year is None or end_quarter is None:
            return jsonify({'error': 'Missing endYear or endQuarter in the request.'}), 400

        # Generate historical data for all points from startYear Q1 to endYear Q4
        history_data = []
        for year in range(start_year, end_year + 1):
            for quarter in range(1, 5):  # Quarters 1 to 4
                if year == end_year and quarter > end_quarter:
                    break  # Stop if we've reached the end quarter

                future_X = prepare_future_input(year, quarter, scaler_year)
                predictions = make_predictions(model, scaler_ts, future_X)

                for point, value in predictions[0].items():
                    history_data.append({
                        'point': point,
                        'year': year,
                        'quarter': quarter,
                        'value': value * 0.625  # Scale the value by 0.625
                    })

        return jsonify({'history': history_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ------------------------------------------------------------------------------------------------------
# below is flood prediction code
# ------------------------------------------------------------------------------------------------------
import pickle
import pandas as pd
import numpy as np
from prophet import Prophet

flood_model = None
prophet_train = None

def load_flood_model():
    """Loads already‑trained Prophet model and training CSV."""
    global flood_model, prophet_train
    MODEL_FILE = "model/flood/prophet_model.pkl"     # Adjust if your file is named differently
    TRAIN_FILE = "prophet_train.csv"     # Adjust if your file is named differently

    if not os.path.exists(MODEL_FILE):
        raise FileNotFoundError(f"Missing model file: {MODEL_FILE}. Model must be pre-trained.")
    if not os.path.exists(TRAIN_FILE):
        raise FileNotFoundError(f"Missing training CSV: {TRAIN_FILE}. Needed for future regressors.")

    with open(MODEL_FILE, "rb") as fin:
        flood_model = pickle.load(fin)

    prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
    print("Flood model loaded successfully.")

load_flood_model()

@app.route('/flood_predict', methods=['GET'])
def get_flood_prediction():
    """
    Example usage: /flood_predict?date=YYYY-MM-DD
    Returns predicted water area and risk classification for the specified future date.
    """
    global flood_model, prophet_train

    if flood_model is None or prophet_train is None:
        return jsonify({"error": "Flood model not loaded properly."}), 500

    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"error": "Missing `date` query parameter (YYYY-MM-DD)."}), 400

    # Validate date
    try:
        user_input_date = pd.to_datetime(date_str)
    except Exception:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    last_date = prophet_train["ds"].max()
    if user_input_date <= last_date:
        msg = f"Input date must be after the last training date: {last_date.date()}"
        return jsonify({"error": msg}), 400

    # Make future dataframe
    forecast_days = (user_input_date - last_date).days
    future = flood_model.make_future_dataframe(periods=forecast_days, freq="D")

    # Basic date-based features
    future["month"] = future["ds"].dt.month
    future["day_of_year"] = future["ds"].dt.dayofyear
    future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
    future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
    future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
    future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

    # Simulate future regressor values using monthly averages
    regressors_to_simulate = [
        "Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity",
        "Max_Temperature", "Average_Wind_Speed", "Max_Wind_Speed"
    ]
    for reg in regressors_to_simulate:
        if reg in prophet_train.columns:
            monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
            future[reg] = future["ds"].dt.month.map(monthly_avg)

    # Fill any lag or rolling features with the last known value
    fill_with_last = [
        "lag1", "lag3", "lag7", "lag14",
        "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
        "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
        "monthly_mean", "monthly_max"
    ]
    for col in fill_with_last:
        if col in prophet_train.columns:
            last_val = prophet_train[col].iloc[-1]
            future[col] = last_val

    # Predict
    forecast = flood_model.predict(future)
    forecast_for_date = forecast[forecast["ds"] == user_input_date]
    if forecast_for_date.empty:
        return jsonify({"error": "No forecast available for that date."}), 404

    row = forecast_for_date.iloc[0]
    water_area = row["yhat"]

    # Simple risk logic (adjust thresholds as needed)
    if water_area < 7.5:
        risk_level = "Low Risk"
        alerts = ["No flood warning", "Continue normal activities"]
    elif water_area < 9.0:
        risk_level = "Moderate Risk"
        alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
    else:
        risk_level = "High Risk"
        alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]

    result = {
        "date": str(user_input_date.date()),
        "predicted_water_area_km2": float(round(water_area, 2)),
        "flood_warning": risk_level,
        "alerts": alerts,
        "prediction_interval": {
            "lower": float(round(row.get("yhat_lower", 0.0), 2)),
            "upper": float(round(row.get("yhat_upper", 0.0), 2))
        }
    }
    return jsonify(result), 200

# Start the Flask app (unchanged)
if __name__ == '__main__':
    app.run(debug=True)