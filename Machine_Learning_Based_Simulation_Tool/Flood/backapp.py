import os
import pickle
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
from sklearn.metrics import r2_score, mean_absolute_error
from itertools import product
from sklearn.model_selection import TimeSeriesSplit
import uvicorn
import math

app = FastAPI()

# Enable CORS for your front end (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_FILE = "prophet_model.pkl"
TRAIN_FILE = "prophet_train.csv"
THRESHOLD_FILE = "water_area_threshold.txt"

# Set to True if you want to apply a log transformation to the target
USE_LOG_TRANSFORM = True

# Global models for additional regressors
temperature_model = None
humidity_model = None
rainfall_model = None

def load_threshold():
    try:
        with open(THRESHOLD_FILE, "r") as f:
            content = f.read().strip()
            parts = content.split(":")
            if len(parts) >= 2:
                threshold_str = parts[1].strip()
                return float(threshold_str)
    except Exception as e:
        print("Error loading threshold:", e)
    return None

def evaluate_and_print(model, prophet_train):
    try:
        print("Evaluating model with cross-validation...")
        # Adjust these parameters as needed
        df_cv = cross_validation(model, initial='730 days', period='180 days', horizon='365 days')
        df_perf = performance_metrics(df_cv)
        r2 = r2_score(df_cv['y'], df_cv['yhat'])
        print(f"Evaluation metrics: R²: {r2:.4f}, MAE: {df_perf['mae'].mean():.4f}, "
              f"RMSE: {df_perf['rmse'].mean():.4f}, MAPE: {df_perf['mape'].mean():.4f}")
    except Exception as e:
        print("Evaluation error:", e)

def load_and_train_model():
    global temperature_model, humidity_model, rainfall_model

    # If the model and training file exist, load them
    if os.path.exists(MODEL_FILE) and os.path.exists(TRAIN_FILE):
        with open(MODEL_FILE, "rb") as fin:
            model = pickle.load(fin)
        prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
        print("Loaded saved model and training data from disk.")
        evaluate_and_print(model, prophet_train)
    else:
        print("Training model from scratch using master2.csv...")
        data = pd.read_csv("master2.csv")
        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values(by="date")

        # Create seasonal features
        data["month"] = data["date"].dt.month
        data["day_of_year"] = data["date"].dt.dayofyear
        data["month_sin"] = np.sin(2 * np.pi * data["month"] / 12)
        data["month_cos"] = np.cos(2 * np.pi * data["month"] / 12)
        data["day_sin"] = np.sin(2 * np.pi * data["day_of_year"] / 365)
        data["day_cos"] = np.cos(2 * np.pi * data["day_of_year"] / 365)

        # Create lag features for water_area_km2
        data["lag1"] = data["water_area_km2"].shift(1)
        data["lag3"] = data["water_area_km2"].shift(3)
        data["lag7"] = data["water_area_km2"].shift(7)
        data["lag14"] = data["water_area_km2"].shift(14)

        # Create rolling and expanding statistics
        data["rolling_avg_7"] = data["water_area_km2"].rolling(window=7).mean()
        data["rolling_std_7"] = data["water_area_km2"].rolling(window=7).std()
        data["expanding_mean"] = data["water_area_km2"].expanding().mean()
        
        # Create monthly aggregates for water_area_km2
        data["month_year"] = data["date"].dt.to_period("M")
        monthly_aggregates = data.groupby("month_year")["water_area_km2"].agg(["mean", "max"]).reset_index()
        monthly_aggregates.columns = ["month_year", "monthly_mean", "monthly_max"]
        data = pd.merge(data, monthly_aggregates, how="left", on="month_year")
        
        # Forward-fill missing values
        data = data.ffill()

        # Use first 70% of data for training
        split_idx = int(len(data) * 0.7)
        train_data = data.iloc[:split_idx].dropna()

        # Prepare training data for Prophet, with optional log transform
        if USE_LOG_TRANSFORM:
            train_data["y_trans"] = np.log(train_data["water_area_km2"] + 1e-8)
            prophet_train = train_data.rename(columns={"date": "ds", "y_trans": "y"})
        else:
            prophet_train = train_data.rename(columns={"date": "ds", "water_area_km2": "y"})

        # Define additional regressors using available fields
        additional_regressors = [
            "Rainfall", "Average_Temperature", "Max_Temperature",
            "Average_Humidity", "Max_Humidity", "Average_Wind_Speed", "Max_Wind_Speed",
            "mean_ndwi", "lag1", "lag3", "lag7", "lag14",
            "rolling_avg_7", "rolling_std_7", "expanding_mean",
            "month_sin", "month_cos", "day_sin", "day_cos",
            "monthly_mean", "monthly_max"
        ]
        for reg in additional_regressors:
            if reg in train_data.columns:
                prophet_train[reg] = train_data[reg]

        # Expanded hyperparameter grid including seasonality_mode
        param_grid = {
            "changepoint_prior_scale": [0.01, 0.1, 0.5, 1.0],
            "seasonality_prior_scale": [0.1, 1.0, 5.0, 10.0],
            "seasonality_mode": ["additive", "multiplicative"]
        }
        best_params = None
        best_score = float("inf")
        tscv = TimeSeriesSplit(n_splits=5)
        for cps in param_grid["changepoint_prior_scale"]:
            for sps in param_grid["seasonality_prior_scale"]:
                for mode in param_grid["seasonality_mode"]:
                    cv_scores = []
                    for train_idx, val_idx in tscv.split(prophet_train):
                        train_cv, val_cv = prophet_train.iloc[train_idx], prophet_train.iloc[val_idx]
                        model_cv = Prophet(
                            changepoint_prior_scale=cps,
                            seasonality_prior_scale=sps,
                            seasonality_mode=mode,
                            daily_seasonality=True
                        )
                        for reg in additional_regressors:
                            if reg in prophet_train.columns:
                                model_cv.add_regressor(reg)
                        model_cv.fit(train_cv)
                        forecast_cv = model_cv.predict(val_cv)
                        mae = mean_absolute_error(val_cv["y"], forecast_cv["yhat"])
                        cv_scores.append(mae)
                    avg_cv_score = np.mean(cv_scores)
                    if avg_cv_score < best_score:
                        best_score = avg_cv_score
                        best_params = (cps, sps, mode)
        optimal_cps, optimal_sps, optimal_mode = best_params
        print(f"Optimal parameters: changepoint_prior_scale={optimal_cps}, "
              f"seasonality_prior_scale={optimal_sps}, seasonality_mode={optimal_mode}")

        # Train the final Prophet model with optimal parameters
        model = Prophet(
            changepoint_prior_scale=optimal_cps,
            seasonality_prior_scale=optimal_sps,
            seasonality_mode=optimal_mode,
            daily_seasonality=True
        )
        for reg in additional_regressors:
            if reg in prophet_train.columns:
                model.add_regressor(reg)
        model.fit(prophet_train)

        # Save the model and training data to disk
        with open(MODEL_FILE, "wb") as fout:
            pickle.dump(model, fout)
        prophet_train.to_csv(TRAIN_FILE, index=False)
        print("Model training complete and saved to disk.")

        # Evaluate and print metrics
        evaluate_and_print(model, prophet_train)

    # Train separate models for additional regressors if available
    if "Average_Temperature" in prophet_train.columns:
        temp_df = prophet_train[["ds", "Average_Temperature"]].dropna().rename(columns={"Average_Temperature": "y"})
        temperature_model = Prophet(daily_seasonality=True)
        temperature_model.fit(temp_df)
        print("Temperature model trained.")
    if "Average_Humidity" in prophet_train.columns:
        hum_df = prophet_train[["ds", "Average_Humidity"]].dropna().rename(columns={"Average_Humidity": "y"})
        humidity_model = Prophet(daily_seasonality=True)
        humidity_model.fit(hum_df)
        print("Humidity model trained.")
    if "Rainfall" in prophet_train.columns:
        rain_df = prophet_train[["ds", "Rainfall"]].dropna().rename(columns={"Rainfall": "y"})
        rainfall_model = Prophet(daily_seasonality=True)
        rainfall_model.fit(rain_df)
        print("Rainfall model trained.")
    
    return {"model": model, "prophet_train": prophet_train}

model_info = load_and_train_model()
prophet_model = model_info["model"]
prophet_train = model_info["prophet_train"]

def calculate_flood_effect_on_land_cover_and_usage(water_area, risk_level):
    if risk_level == "High Risk":
        return {
            "land_cover_effect": "Significant loss of vegetation and increased open water areas",
            "land_usage_effect": "Severe disruption to agriculture, residential, and commercial activities",
            "effect_explanation": "The high flood risk causes extensive damage and a drastic change in land usability."
        }
    elif risk_level == "Moderate Risk":
        return {
            "land_cover_effect": "Moderate reduction in vegetation with temporary waterlogging",
            "land_usage_effect": "Noticeable impact on land usage with partial disruptions",
            "effect_explanation": "Moderate flooding leads to some damage and temporary land usage changes."
        }
    else:
        return {
            "land_cover_effect": "Minimal damage to vegetation",
            "land_usage_effect": "Negligible impact on land usage",
            "effect_explanation": "Low flood risk results in little or no damage to land cover or usage."
        }

@app.get("/predict")
async def get_prediction(date: str = Query(..., description="Forecast end date (YYYY-MM-DD)")):
    try:
        user_input_date = pd.to_datetime(date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    last_date = prophet_train["ds"].max()
    if user_input_date <= last_date:
        raise HTTPException(status_code=400, detail=f"Input date must be after the last training date: {last_date.date()}")

    forecast_days = (user_input_date - last_date).days
    future = prophet_model.make_future_dataframe(periods=forecast_days, freq="D")
    
    # Re-create seasonal features for future dates
    future["month"] = future["ds"].dt.month
    future["day_of_year"] = future["ds"].dt.dayofyear
    future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
    future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
    future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
    future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

    # Simulate future values for regressors using historical monthly averages
    regressors_to_simulate = [
        "Rainfall", "Average_Temperature", "Max_Temperature",
        "Average_Humidity", "Max_Humidity", "Average_Wind_Speed", "Max_Wind_Speed", "mean_ndwi"
    ]
    for reg in regressors_to_simulate:
        if reg in prophet_train.columns:
            monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
            future[reg] = future["ds"].dt.month.map(monthly_avg)
    
    # For lag and rolling features, use last observed values
    last_value = prophet_train["y"].iloc[-1]
    for reg in ["lag1", "lag3", "lag7", "lag14"]:
        future[reg] = last_value
    for col in ["rolling_avg_7", "rolling_std_7", "expanding_mean", "monthly_mean", "monthly_max"]:
        if col in prophet_train.columns:
            future[col] = prophet_train[col].iloc[-1]

    future_forecast = prophet_model.predict(future)
    forecast_for_date = future_forecast[future_forecast["ds"] == user_input_date]
    if forecast_for_date.empty:
        raise HTTPException(status_code=404, detail="No forecast available for the specified date.")
    row = forecast_for_date.iloc[0]
    water_area = row["yhat"]

    # If using log transform, invert the transformation
    if USE_LOG_TRANSFORM:
        water_area = np.exp(water_area)

    # Determine flood risk based on a threshold (if available)
    threshold = load_threshold()
    if threshold is not None:
        if water_area < 0.8 * threshold:
            risk_level = "Low Risk"
            alerts = ["No flood warning", "Continue normal activities"]
        elif water_area < threshold:
            risk_level = "Moderate Risk"
            alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
        else:
            risk_level = "High Risk"
            alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]
    else:
        if water_area < 7.5:
            risk_level = "Low Risk"
            alerts = ["No flood warning", "Continue normal activities"]
        elif water_area < 9.0:
            risk_level = "Moderate Risk"
            alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
        else:
            risk_level = "High Risk"
            alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]

    # (Additional regressor forecasts and explainability code remains unchanged)
    result = {
        "date": str(user_input_date.date()),
        "predicted_water_area_km2": float(round(water_area, 2)),
        "flood_warning": risk_level,
        "risk_level": risk_level,
        "alerts": alerts,
        # ... other fields as needed
    }
    return result

@app.get("/evaluate")
async def evaluate_model():
    try:
        df_cv = cross_validation(prophet_model, initial='730 days', period='180 days', horizon='365 days')
        df_perf = performance_metrics(df_cv)
        r2 = r2_score(df_cv['y'], df_cv['yhat'])
        metrics = {
            "r2_score": r2,
            "mae": df_perf['mae'].mean(),
            "rmse": df_perf['rmse'].mean(),
            "mape": df_perf['mape'].mean()
        }
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)