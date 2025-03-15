import os
import pickle
import pandas as pd
import numpy as np
from prophet import Prophet

MODEL_FILE = "model/prophet_model.pkl"
TRAIN_FILE = "cvs/prophet_train.csv"

# Global variables
prophet_model = None
prophet_train = None
FLOOD_THRESHOLD = None

def get_flood_threshold_from_master():
    """
    Reads 'master.csv' to compute the top 5% threshold for 'water_area_km2'.
    """
    file_path = "master2.csv"
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found. Using fallback threshold = 9.0.")
        return 9.0

    df = pd.read_csv(file_path)
    if "water_area_km2" not in df.columns or df["water_area_km2"].dropna().empty:
        print(f"Warning: 'water_area_km2' is missing or empty in {file_path}. Fallback = 9.0.")
        return 9.0

    return np.percentile(df["water_area_km2"].dropna(), 95)

def load_models():
    """
    Loads the pre-trained Prophet models from disk.
    """
    global prophet_model, prophet_train, FLOOD_THRESHOLD

    FLOOD_THRESHOLD = get_flood_threshold_from_master()

    if not os.path.exists(MODEL_FILE) or not os.path.exists(TRAIN_FILE):
        raise FileNotFoundError("Pre-trained model files not found!")

    with open(MODEL_FILE, "rb") as fin:
        model = pickle.load(fin)
    prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
    print("Loaded saved water area model and training data from disk.")

    return model, prophet_train

def get_prediction(date_str):
    """
    Makes prediction for a given date and returns flood risk assessment
    """
    try:
        user_input_date = pd.to_datetime(date_str)
        last_date = prophet_train["ds"].max()
        
        if user_input_date <= last_date:
            raise ValueError(f"Input date must be after the last training date: {last_date.date()}")
        
        # Generate future dataframe
        forecast_days = (user_input_date - last_date).days
        future = prophet_model.make_future_dataframe(periods=forecast_days, freq="D")

        # Date-based features
        future["month"] = future["ds"].dt.month
        future["day_of_year"] = future["ds"].dt.dayofyear
        future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
        future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
        future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
        future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

        # Use last known values for other features
        for col in prophet_train.columns:
            if col not in ["ds", "y"] and col in prophet_train.columns:
                future[col] = prophet_train[col].iloc[-1]

        # Predict
        future_forecast = prophet_model.predict(future)
        forecast_for_date = future_forecast[future_forecast["ds"] == user_input_date]
        
        if forecast_for_date.empty:
            raise ValueError("No forecast available for the specified date.")
        
        row = forecast_for_date.iloc[0]
        water_area = row["yhat"]

        # Risk level determination
        if water_area < 0.8 * FLOOD_THRESHOLD:
            risk_level = "Low Risk"
            alerts = ["No flood warning", "Continue normal activities"]
        elif water_area < FLOOD_THRESHOLD:
            risk_level = "Moderate Risk"
            alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
        else:
            risk_level = "High Risk"
            alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]

        return {
            "date": str(user_input_date.date()),
            "predicted_water_area_km2": float(round(water_area, 2)),
            "flood_warning": risk_level,
            "risk_level": risk_level,
            "alerts": alerts,
            "prediction_interval": {
                "lower": float(round(row["yhat_lower"], 2)),
                "upper": float(round(row["yhat_upper"], 2))
            }
        }

    except Exception as e:
        raise Exception(f"Prediction error: {str(e)}")

# Initialize models at startup
prophet_model, prophet_train = load_models()
