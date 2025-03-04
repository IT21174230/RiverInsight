import os
import pickle
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
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

# Global variables for extra regressor models and evaluation metrics
temperature_model = None
humidity_model = None
rainfall_model = None
evaluation_metrics = {}

def compute_test_metrics(model):
    # Re-read the full dataset and re-compute all features (as in training)
    data = pd.read_csv("master2.csv")
    data["date"] = pd.to_datetime(data["date"])
    data = data.sort_values(by="date")
    
    # Date-based features
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

    # Rolling and cumulative features
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

    # Use last 30% as test data
    test_data = data.iloc[int(len(data) * 0.7):].dropna()
    prophet_test = test_data.rename(columns={"date": "ds", "water_area_km2": "y"})
    
    # Updated list of additional regressors
    additional_regressors = [
        "Average_Temperature", "Rainfall", "lag1", "lag3", "lag7", "lag14",
        "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
        "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
        "month_sin", "month_cos", "day_sin", "day_cos",
        "monthly_mean", "monthly_max", "Average_Humidity", "Max_Humidity",
        "Average_Wind_Speed", "Max_Wind_Speed", "Max_Temperature"
    ]
    for reg in additional_regressors:
        if reg in test_data.columns:
            prophet_test[reg] = test_data[reg]
    
    forecast_test = model.predict(prophet_test)
    mae_test = mean_absolute_error(prophet_test["y"], forecast_test["yhat"])
    mse_test = mean_squared_error(prophet_test["y"], forecast_test["yhat"])
    r2_test = r2_score(prophet_test["y"], forecast_test["yhat"])
    evaluation_metrics.update({
        "mae_test": mae_test,
        "rmse_test": np.sqrt(mse_test),
        "r2_test": r2_test
    })
    print("Test Evaluation Metrics:")
    print(f"MAE: {mae_test:.2f}")
    print(f"RMSE: {np.sqrt(mse_test):.2f}")
    print(f"R²: {r2_test:.2f}")

def load_and_train_model():
    global temperature_model, humidity_model, rainfall_model, evaluation_metrics

    if os.path.exists(MODEL_FILE) and os.path.exists(TRAIN_FILE):
        with open(MODEL_FILE, "rb") as fin:
            model = pickle.load(fin)
        prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
        print("Loaded saved water area model and training data from disk.")

        # Compute training metrics
        forecast_train = model.predict(prophet_train)
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
        
        # Compute test metrics
        compute_test_metrics(model)
    else:
        print("Training water area model from scratch...")
        data = pd.read_csv("master2.csv")
        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values(by="date")

        # Date-based features
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

        # Rolling and cumulative features
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

        # Updated additional regressors list
        additional_regressors = [
            "Average_Temperature", "Rainfall", "lag1", "lag3", "lag7", "lag14",
            "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
            "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
            "month_sin", "month_cos", "day_sin", "day_cos",
            "monthly_mean", "monthly_max", "Average_Humidity", "Max_Humidity",
            "Average_Wind_Speed", "Max_Wind_Speed", "Max_Temperature"
        ]
        for reg in additional_regressors:
            if reg in train_data.columns:
                prophet_train[reg] = train_data[reg]

        # Hyperparameter tuning using cross‑validation
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
        print(f"Optimal Hyperparameters: changepoint_prior_scale={optimal_changepoint_prior_scale}, seasonality_prior_scale={optimal_seasonality_prior_scale}")

        # Train the final model with optimal hyperparameters
        model = Prophet(
            changepoint_prior_scale=optimal_changepoint_prior_scale,
            seasonality_prior_scale=optimal_seasonality_prior_scale,
            daily_seasonality=True
        )
        for reg in additional_regressors:
            if reg in prophet_train.columns:
                model.add_regressor(reg)
        model.fit(prophet_train)

        # Compute training metrics
        forecast_train = model.predict(prophet_train)
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

        # Compute test metrics
        compute_test_metrics(model)

        with open(MODEL_FILE, "wb") as fout:
            pickle.dump(model, fout)
        prophet_train.to_csv(TRAIN_FILE, index=False)
        print("Water area model training complete. Saved to disk.")

    # Train separate models for extra regressors
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
        raise HTTPException(
            status_code=400,
            detail=f"Input date must be after the last training date: {last_date.date()}"
        )
    
    forecast_days = (user_input_date - last_date).days
    future = prophet_model.make_future_dataframe(periods=forecast_days, freq="D")
    # Compute date-based features for future dates
    future["month"] = future["ds"].dt.month
    future["day_of_year"] = future["ds"].dt.dayofyear
    future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
    future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
    future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
    future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

    # Simulate future regressor values using monthly averages (including wind speed features)
    regressors_to_simulate = [
        "Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity",
        "Max_Temperature", "Average_Wind_Speed", "Max_Wind_Speed"
    ]
    for reg in regressors_to_simulate:
        if reg in prophet_train.columns:
            monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
            future[reg] = future["ds"].dt.month.map(monthly_avg)
    
    # For lag and rolling features, use the last observed value
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

    # Define risk thresholds
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

    # Simulate predicted wind speed using monthly averages if available
    if "Average_Wind_Speed" in prophet_train.columns:
        monthly_avg_wind = prophet_train.groupby(prophet_train["ds"].dt.month)["Average_Wind_Speed"].mean().to_dict()
        predicted_wind_speed = float(round(monthly_avg_wind.get(user_input_date.month, 0), 2))
    else:
        predicted_wind_speed = None

    # Prepare chart data (from the beginning of the current year to forecast date)
    year_start = pd.Timestamp(year=user_input_date.year, month=1, day=1)
    chart_df = future_forecast[(future_forecast["ds"] >= year_start) & (future_forecast["ds"] <= user_input_date)].copy()
    chart_df["date"] = chart_df["ds"].dt.strftime("%b %d")
    chart_data = chart_df[["date", "yhat"]].rename(columns={"yhat": "value"}).to_dict(orient="records")

    # Define explainable factor and flood effects (dummy values)
    explainable_factor = {
        "explanation": "The flood risk is primarily driven by rising water levels and heavy rainfall patterns."
    }
    flood_effect = {
        "land_cover_effect": "Significant impact on vegetation and soil erosion.",
        "land_usage_effect": "Urban and agricultural areas may face disruption.",
        "effect_explanation": "Flooding can result in long-term changes in land cover and economic losses."
    }

    # Print evaluation metrics on each GET request
    print("GET /predict request for date:", user_input_date.date())
    print("Training Evaluation Metrics:")
    print(f"MAE: {evaluation_metrics.get('mae_train', None):.2f}, RMSE: {evaluation_metrics.get('rmse_train', None):.2f}, R²: {evaluation_metrics.get('r2_train', None):.2f}")
    print("Test Evaluation Metrics:")
    print(f"MAE: {evaluation_metrics.get('mae_test', None):.2f}, RMSE: {evaluation_metrics.get('rmse_test', None):.2f}, R²: {evaluation_metrics.get('r2_test', None):.2f}")

    result = {
        "date": str(user_input_date.date()),
        "predicted_water_area_km2": float(round(water_area, 2)),
        "flood_warning": risk_level,
        "risk_level": risk_level,
        "alerts": alerts,
        "predicted_temperature": predicted_temperature,
        "predicted_humidity": predicted_humidity,
        "predicted_rainfall": predicted_rainfall,
        "predicted_wind_speed": predicted_wind_speed,
        "current_water_area_km2": float(round(water_area, 2)),
        "rainfall_mm": predicted_rainfall if predicted_rainfall is not None else 0,
        "prediction_interval": {
            "lower": float(round(row["yhat_lower"], 2)),
            "upper": float(round(row["yhat_upper"], 2))
        },
        "regressor_values": {
            reg: float(round(future[reg].iloc[-1], 2))
            for reg in [
                "Average_Temperature", "Rainfall", "Average_Humidity",
                "Max_Humidity", "Max_Temperature", "Average_Wind_Speed", "Max_Wind_Speed"
            ]
            if reg in future.columns
        },
        "chart_data": chart_data,
        "evaluation_metrics": evaluation_metrics,
        "explainable_factor": explainable_factor,
        "flood_effect": flood_effect
    }
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)