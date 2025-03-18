# utils.py
import os
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from prophet import Prophet

# Shared dictionary for training & test metrics
evaluation_metrics = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
def get_flood_threshold_from_master():
    """
    Reads 'master2.csv' to compute the top 5% threshold for 'water_area_km2'.
    """
    file_path = (os.path.join(BASE_DIR, "master2.csv"))
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found. Using fallback threshold = 9.0.")
        return 9.0

    df = pd.read_csv(file_path)
    if "water_area_km2" not in df.columns or df["water_area_km2"].dropna().empty:
        print(f"Warning: 'water_area_km2' is missing/empty in {file_path}. Fallback = 9.0.")
        return 9.0

    top_5_percentile = np.percentile(df["water_area_km2"].dropna(), 95)
    print("Computed Top 5% Threshold (Flood Marker):", top_5_percentile)
    return top_5_percentile


def compute_test_metrics(model):
    """
    Reads 'master2.csv', creates features, and evaluates test performance (last 30%).
    """
    data = pd.read_csv(os.path.join(BASE_DIR, "master2.csv"))
    data["date"] = pd.to_datetime(data["date"])
    data = data.sort_values(by="date")

    # Feature engineering
    data["month"] = data["date"].dt.month
    data["day_of_year"] = data["date"].dt.dayofyear
    data["month_sin"] = np.sin(2 * np.pi * data["month"] / 12)
    data["month_cos"] = np.cos(2 * np.pi * data["month"] / 12)
    data["day_sin"] = np.sin(2 * np.pi * data["day_of_year"] / 365)
    data["day_cos"] = np.cos(2 * np.pi * data["day_of_year"] / 365)

    data["lag1"] = data["water_area_km2"].shift(1)
    data["lag3"] = data["water_area_km2"].shift(3)
    data["lag7"] = data["water_area_km2"].shift(7)
    data["lag14"] = data["water_area_km2"].shift(14)

    data["rolling_avg_7"] = data["water_area_km2"].rolling(window=7).mean()
    data["rolling_median_7"] = data["water_area_km2"].rolling(window=7).median()
    data["rolling_std_7"] = data["water_area_km2"].rolling(window=7).std()
    data["expanding_mean"] = data["water_area_km2"].expanding().mean()
    data["cumulative_rainfall"] = data["Rainfall"].cumsum()
    data["rainfall_ndwi_interaction"] = data["Rainfall"] * data["mean_ndwi"]
    data["extreme_rainfall"] = (data["Rainfall"] > data["Rainfall"].quantile(0.95)).astype(int)

    data["month_year"] = data["date"].dt.to_period("M")
    monthly_aggregates = data.groupby("month_year")[["water_area_km2"]].agg(["mean", "max"]).reset_index()
    monthly_aggregates.columns = ["month_year", "monthly_mean", "monthly_max"]
    data = pd.merge(data, monthly_aggregates, how="left", on="month_year")
    data = data.ffill()

    # Last 30% is test
    test_data = data.iloc[int(len(data) * 0.7):].dropna()
    prophet_test = test_data.rename(columns={"date": "ds", "water_area_km2": "y"})

    # Additional regressors
    extra_regrs = [
        "Average_Temperature", "Rainfall", "lag1", "lag3", "lag7", "lag14",
        "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
        "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
        "month_sin", "month_cos", "day_sin", "day_cos",
        "monthly_mean", "monthly_max", "Average_Humidity", "Max_Humidity",
        "Average_Wind_Speed", "Max_Wind_Speed", "Max_Temperature"
    ]
    for reg in extra_regrs:
        if reg in test_data.columns:
            prophet_test[reg] = test_data[reg]

    # Predictions
    forecast_test = model.predict(prophet_test)
    mae_test = mean_absolute_error(prophet_test["y"], forecast_test["yhat"])
    mse_test = mean_squared_error(prophet_test["y"], forecast_test["yhat"])
    r2_test = r2_score(prophet_test["y"], forecast_test["yhat"])

    evaluation_metrics.update({
        "mae_test": mae_test,
        "rmse_test": np.sqrt(mse_test),
        "r2_test": r2_test
    })
    # print("Test Evaluation Metrics:")
    # print(f"MAE: {mae_test:.2f}")
    # print(f"RMSE: {np.sqrt(mse_test):.2f}")
    # print(f"R²: {r2_test:.2f}")