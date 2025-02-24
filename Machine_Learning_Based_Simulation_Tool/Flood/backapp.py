import os
import pickle
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prophet import Prophet
from sklearn.metrics import mean_absolute_error
from itertools import product
from sklearn.model_selection import TimeSeriesSplit
import uvicorn

app = FastAPI()

# Enable CORS for your React front end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # adjust if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_FILE = "prophet_model.pkl"
TRAIN_FILE = "prophet_train.csv"

# Global variables for extra regressor models
temperature_model = None
humidity_model = None
rainfall_model = None

def load_and_train_model():
    global temperature_model, humidity_model, rainfall_model

    if os.path.exists(MODEL_FILE) and os.path.exists(TRAIN_FILE):
        with open(MODEL_FILE, "rb") as fin:
            model = pickle.load(fin)
        prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
        print("Loaded saved water area model and training data from disk.")
    else:
        print("Training water area model from scratch...")
        data = pd.read_csv("master2.csv")
        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values(by="date")

        # Create date-based features
        data["month"] = data["date"].dt.month
        data["day_of_year"] = data["date"].dt.dayofyear
        data["month_sin"] = np.sin(2 * np.pi * data["month"] / 12)
        data["month_cos"] = np.cos(2 * np.pi * data["month"] / 12)
        data["day_sin"] = np.sin(2 * np.pi * data["day_of_year"] / 365)
        data["day_cos"] = np.cos(2 * np.pi * data["day_of_year"] / 365)

        # Lag features
        data["lag1"] = data["water_area_km2"].shift(1)
        data["lag3"] = data["water_area_km2"].shift(3)
        data["lag7"] = data["water_area_km2"].shift(7)
        data["lag14"] = data["water_area_km2"].shift(14)

        # Rolling/cumulative features
        data["rolling_avg_7"] = data["water_area_km2"].rolling(window=7).mean()
        data["rolling_median_7"] = data["water_area_km2"].rolling(window=7).median()
        data["rolling_std_7"] = data["water_area_km2"].rolling(window=7).std()
        data["expanding_mean"] = data["water_area_km2"].expanding().mean()
        data["cumulative_rainfall"] = data["Rainfall"].cumsum()
        data["rainfall_ndwi_interaction"] = data["Rainfall"] * data["mean_ndwi"]
        data["extreme_rainfall"] = (data["Rainfall"] > data["Rainfall"].quantile(0.95)).astype(int)

        # Monthly aggregates
        data["month_year"] = data["date"].dt.to_period("M")
        monthly_aggregates = data.groupby("month_year")[["water_area_km2"]].agg(["mean", "max"]).reset_index()
        monthly_aggregates.columns = ["month_year", "monthly_mean", "monthly_max"]
        data = pd.merge(data, monthly_aggregates, how="left", on="month_year")
        
        data = data.ffill()

        # Use first 70% as training data
        train_data = data.iloc[:int(len(data) * 0.7)].dropna()
        prophet_train = train_data.rename(columns={"date": "ds", "water_area_km2": "y"})

        # Additional regressors used in water area model
        additional_regressors = [
            "Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity",
            "Max_Temperature",
            "lag1", "lag3", "lag7", "lag14",
            "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
            "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
            "month_sin", "month_cos", "day_sin", "day_cos",
            "monthly_mean", "monthly_max"
        ]
        for reg in additional_regressors:
            if reg in train_data.columns:
                prophet_train[reg] = train_data[reg]

        # Hyperparameter tuning via cross-validation for water area model
        tscv = TimeSeriesSplit(n_splits=2)
        param_grid = {
            "changepoint_prior_scale": [0.01, 0.1, 0.5, 1.0],
            "seasonality_prior_scale": [0.1, 1.0, 5.0, 10.0]
        }
        best_params = None
        best_score = float("inf")
        for cps, sps in product(param_grid["changepoint_prior_scale"], param_grid["seasonality_prior_scale"]):
            cv_scores = []
            for train_idx, val_idx in tscv.split(prophet_train):
                train_cv, val_cv = prophet_train.iloc[train_idx], prophet_train.iloc[val_idx]
                model_cv = Prophet(
                    changepoint_prior_scale=cps,
                    seasonality_prior_scale=sps,
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
                best_params = (cps, sps)
        optimal_changepoint_prior_scale, optimal_seasonality_prior_scale = best_params

        # Train the final water area model
        model = Prophet(
            changepoint_prior_scale=optimal_changepoint_prior_scale,
            seasonality_prior_scale=optimal_seasonality_prior_scale,
            daily_seasonality=True
        )
        for reg in additional_regressors:
            if reg in prophet_train.columns:
                model.add_regressor(reg)
        model.fit(prophet_train)

        with open(MODEL_FILE, "wb") as fout:
            pickle.dump(model, fout)
        prophet_train.to_csv(TRAIN_FILE, index=False)
        print("Water area model training complete. Saved to disk.")

    # Train separate models for extra regressors:
    global temperature_model, humidity_model, rainfall_model
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
    future["month"] = future["ds"].dt.month
    future["day_of_year"] = future["ds"].dt.dayofyear
    future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
    future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
    future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
    future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

    # Simulate future regressor values using monthly averages
    regressors_to_simulate = [
        "Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity", "Max_Temperature"
    ]
    for reg in regressors_to_simulate:
        if reg in prophet_train.columns:
            monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
            future[reg] = future["ds"].dt.month.map(monthly_avg)
    
    # For lag and rolling features, use last observed value
    last_value = prophet_train["y"].iloc[-1]
    for reg in ["lag1", "lag3", "lag7", "lag14"]:
        future[reg] = last_value
    for col in ["rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
                "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
                "monthly_mean", "monthly_max"]:
        if col in prophet_train.columns:
            future[col] = prophet_train[col].iloc[-1]

    future_forecast = prophet_model.predict(future)
    forecast_for_date = future_forecast[future_forecast["ds"] == user_input_date]
    if forecast_for_date.empty:
        raise HTTPException(status_code=404, detail="No forecast available for the specified date.")
    row = forecast_for_date.iloc[0]
    water_area = row["yhat"]

    # Risk thresholds: <7.5 => Low, 7.5–15 => Moderate, >=15 => High
    if water_area < 7.5:
        risk_level = "Low Risk"
        alerts = ["No flood warning", "Continue normal activities"]
    elif water_area < 9.0:
        risk_level = "Moderate Risk"
        alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
    else:
        risk_level = "High Risk"
        alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]

    # Predict additional parameters using separate models
    if temperature_model is not None:
        temp_forecast = temperature_model.predict(pd.DataFrame({"ds": [user_input_date]}))
        predicted_temperature = float(round(temp_forecast.iloc[0]["yhat"], 2))
    else:
        predicted_temperature = None

    if humidity_model is not None:
        hum_forecast = humidity_model.predict(pd.DataFrame({"ds": [user_input_date]}))
        predicted_humidity = float(round(hum_forecast.iloc[0]["yhat"], 2))
    else:
        predicted_humidity = None

    if rainfall_model is not None:
        rain_forecast = rainfall_model.predict(pd.DataFrame({"ds": [user_input_date]}))
        predicted_rainfall = float(round(rain_forecast.iloc[0]["yhat"], 2))
    else:
        predicted_rainfall = None

    # Prepare chart data from January 1 of the forecast year to user_input_date
    year_start = pd.Timestamp(year=user_input_date.year, month=1, day=1)
    chart_df = future_forecast[(future_forecast["ds"] >= year_start) & (future_forecast["ds"] <= user_input_date)].copy()
    chart_df["date"] = chart_df["ds"].dt.strftime("%b %d")
    chart_data = chart_df[["date", "yhat"]].rename(columns={"yhat": "value"}).to_dict(orient="records")

    result = {
        "date": str(user_input_date.date()),
        "predicted_water_area_km2": float(round(water_area, 2)),
        "flood_warning": risk_level,
        "risk_level": risk_level,
        "alerts": alerts,
        "predicted_temperature": predicted_temperature,
        "predicted_humidity": predicted_humidity,
        "predicted_rainfall": predicted_rainfall,
        "current_water_area_km2": float(round(water_area, 2)),  # placeholder
        "rainfall_mm": predicted_rainfall if predicted_rainfall is not None else 0,
        "prediction_interval": {
            "lower": float(round(row["yhat_lower"], 2)),
            "upper": float(round(row["yhat_upper"], 2))
        },
        "regressor_values": {
            reg: float(round(future[reg].iloc[-1], 2))
            for reg in [
                "Average_Temperature", "Rainfall", "Average_Humidity",
                "Max_Humidity", "Max_Temperature"
            ]
            if reg in future.columns
        },
        "chart_data": chart_data
    }
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)