# models.py
import os
import pickle
import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .utils_module import compute_test_metrics, get_flood_threshold_from_master, evaluation_metrics

# File constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(BASE_DIR, "prophet.pkl")
TRAIN_FILE = os.path.join(BASE_DIR, "prophet_train.csv")


# Global variables for use in other modules
prophet_model = None
prophet_train = None
temperature_model = None
humidity_model = None
rainfall_model = None
FLOOD_THRESHOLD = None


def load_and_train_model():
    """
    Loads the Prophet model from disk if available (no training from scratch).
    Also trains separate models for temperature, humidity, and rainfall if data is present.
    Computes & stores the dynamic flood threshold at startup.
    """
    global prophet_model, prophet_train
    global temperature_model, humidity_model, rainfall_model
    global evaluation_metrics, FLOOD_THRESHOLD

    # Compute the threshold from master2.csv
    FLOOD_THRESHOLD = get_flood_threshold_from_master()

    if os.path.exists(MODEL_FILE) and os.path.exists(TRAIN_FILE):
        # Load the main Prophet model
        with open(MODEL_FILE, "rb") as fin:
            prophet_model = pickle.load(fin)
        prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
        print("Loaded saved water area model and training data from disk.")

        # Evaluate training data
        forecast_train = prophet_model.predict(prophet_train)
        mae_train = mean_absolute_error(prophet_train["y"], forecast_train["yhat"])
        mse_train = mean_squared_error(prophet_train["y"], forecast_train["yhat"])
        rmse_train = np.sqrt(mse_train)
        r2_train = r2_score(prophet_train["y"], forecast_train["yhat"])

        evaluation_metrics.update({
            "mae_train": mae_train,
            "rmse_train": rmse_train,
            "r2_train": r2_train
        })
        print("Training Evaluation Metrics:")
        print(f"MAE: {mae_train:.2f}")
        print(f"RMSE: {rmse_train:.2f}")
        print(f"R²: {r2_train:.2f}")

        # Compute test metrics on the last 30% of data
        compute_test_metrics(prophet_model)
    else:
        print("No existing model files found. Skipping model load and training.")

    # If the main model was loaded (and prophet_train is available), train sub-models
    if prophet_train is not None:
        # Temperature sub-model
        if "Average_Temperature" in prophet_train.columns:
            temp_df = prophet_train[["ds", "Average_Temperature"]].dropna()
            temp_df = temp_df.rename(columns={"Average_Temperature": "y"})
            temp_model = Prophet(daily_seasonality=True)
            temp_model.fit(temp_df)
            temperature_model = temp_model
            print("Temperature model trained.")

        # Humidity sub-model
        if "Average_Humidity" in prophet_train.columns:
            hum_df = prophet_train[["ds", "Average_Humidity"]].dropna()
            hum_df = hum_df.rename(columns={"Average_Humidity": "y"})
            hum_model = Prophet(daily_seasonality=True)
            hum_model.fit(hum_df)
            humidity_model = hum_model
            print("Humidity model trained.")

        # Rainfall sub-model
        if "Rainfall" in prophet_train.columns:
            rain_df = prophet_train[["ds", "Rainfall"]].dropna()
            rain_df = rain_df.rename(columns={"Rainfall": "y"})
            rain_model = Prophet(daily_seasonality=True)
            rain_model.fit(rain_df)
            rainfall_model = rain_model
            print("Rainfall model trained.")


# 1) Load everything at import-time:
load_and_train_model()
# 2) Now you can import:
# from models import prophet_model, temperature_model, ...
# in other files (like routes.py).