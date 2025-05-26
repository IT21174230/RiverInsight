import os
import pickle
import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.metrics import mean_absolute_error
from itertools import product
from sklearn.model_selection import TimeSeriesSplit

MODEL_FILE = os.path.join("model", "prophet_model.pkl")
TRAIN_FILE = os.path.join("model", "prophet_train.csv")
TRAIN_FILE_M = os.path.join("model", "master2.csv")

temperature_model = None
humidity_model = None
rainfall_model = None

def load_model():
    global temperature_model, humidity_model, rainfall_model

    if os.path.exists(MODEL_FILE) and os.path.exists(TRAIN_FILE):
        with open(MODEL_FILE, "rb") as fin:
            model = pickle.load(fin)
        prophet_train = pd.read_csv(TRAIN_FILE, parse_dates=["ds"])
        print("Loaded saved model.")
    else:
        data = pd.read_csv(TRAIN_FILE_M)
        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values(by="date")

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

        train_data = data.iloc[:int(len(data) * 0.7)].dropna()
        prophet_train = train_data.rename(columns={"date": "ds", "water_area_km2": "y"})

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

        model = Prophet(
            changepoint_prior_scale=best_params[0],
            seasonality_prior_scale=best_params[1],
            daily_seasonality=True
        )
        for reg in additional_regressors:
            model.add_regressor(reg)
        model.fit(prophet_train)

        with open(MODEL_FILE, "wb") as fout:
            pickle.dump(model, fout)
        prophet_train.to_csv(TRAIN_FILE, index=False)

    # Train helper models
    if "Average_Temperature" in prophet_train.columns:
        temp_df = prophet_train[["ds", "Average_Temperature"]].dropna().rename(columns={"Average_Temperature": "y"})
        temperature_model = Prophet(daily_seasonality=True).fit(temp_df)
    if "Average_Humidity" in prophet_train.columns:
        hum_df = prophet_train[["ds", "Average_Humidity"]].dropna().rename(columns={"Average_Humidity": "y"})
        humidity_model = Prophet(daily_seasonality=True).fit(hum_df)
    if "Rainfall" in prophet_train.columns:
        rain_df = prophet_train[["ds", "Rainfall"]].dropna().rename(columns={"Rainfall": "y"})
        rainfall_model = Prophet(daily_seasonality=True).fit(rain_df)

    return model, prophet_train, temperature_model, humidity_model, rainfall_model

def calculate_monthly_risk(water_areas):
    """Calculate monthly risk based on daily water area predictions"""
    # Risk thresholds
    low_threshold = 7.5
    high_threshold = 9.0
    
    # Count days in each risk category
    low_risk_days = sum(1 for area in water_areas if area < low_threshold)
    moderate_risk_days = sum(1 for area in water_areas if low_threshold <= area < high_threshold)
    high_risk_days = sum(1 for area in water_areas if area >= high_threshold)
    
    total_days = len(water_areas)
    
    # Calculate percentages
    high_risk_percentage = (high_risk_days / total_days) * 100
    moderate_risk_percentage = (moderate_risk_days / total_days) * 100
    
    # Determine overall monthly risk
    if high_risk_percentage >= 30:  # If 30% or more days are high risk
        monthly_risk = "High Risk"
        risk_alerts = [
            f"High flood risk month - {high_risk_days} high-risk days expected",
            "Prepare emergency plans and evacuation routes",
            "Monitor weather conditions daily",
            "Stock emergency supplies"
        ]
    elif high_risk_percentage >= 10 or moderate_risk_percentage >= 50:  # If 10%+ high risk or 50%+ moderate risk
        monthly_risk = "Moderate Risk"
        risk_alerts = [
            f"Moderate flood risk month - {high_risk_days} high-risk, {moderate_risk_days} moderate-risk days",
            "Stay alert to weather forecasts",
            "Review emergency procedures",
            "Keep emergency kit ready"
        ]
    else:
        monthly_risk = "Low Risk"
        risk_alerts = [
            f"Low flood risk month - mostly safe conditions expected",
            "Continue normal activities",
            f"Only {high_risk_days} high-risk days expected"
        ]
    
    return {
        "monthly_risk": monthly_risk,
        "alerts": risk_alerts,
        "risk_breakdown": {
            "high_risk_days": high_risk_days,
            "moderate_risk_days": moderate_risk_days,
            "low_risk_days": low_risk_days,
            "high_risk_percentage": round(high_risk_percentage, 1),
            "moderate_risk_percentage": round(moderate_risk_percentage, 1)
        }
    }

def flood_prediction_logic(date, model, prophet_train, temperature_model, humidity_model, rainfall_model):
    try:
        user_input_date = pd.to_datetime(date)
    except Exception:
        return {"error": "Invalid date format. Use YYYY-MM-DD"}

    last_date = prophet_train["ds"].max()
    if user_input_date <= last_date:
        return {"error": f"Input date must be after {last_date.date()}"}

    # Get the month and year from input date
    target_month = user_input_date.month
    target_year = user_input_date.year
    
    # Generate all days for the target month
    month_start = pd.Timestamp(year=target_year, month=target_month, day=1)
    if target_month == 12:
        month_end = pd.Timestamp(year=target_year + 1, month=1, day=1) - pd.Timedelta(days=1)
    else:
        month_end = pd.Timestamp(year=target_year, month=target_month + 1, day=1) - pd.Timedelta(days=1)
    
    # Calculate forecast days needed
    forecast_days = (month_end - last_date).days
    future = model.make_future_dataframe(periods=forecast_days, freq="D")
    
    # Add time-based features
    future["month"] = future["ds"].dt.month
    future["day_of_year"] = future["ds"].dt.dayofyear
    future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
    future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
    future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
    future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

    # Simulate weather regressors using historical monthly averages
    regressors_to_simulate = ["Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity", "Max_Temperature"]
    for reg in regressors_to_simulate:
        if reg in prophet_train.columns:
            monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
            future[reg] = future["ds"].dt.month.map(monthly_avg)

    # Fill lag and rolling features with last known values
    last_value = prophet_train["y"].iloc[-1]
    for reg in ["lag1", "lag3", "lag7", "lag14"]:
        future[reg] = last_value
    for col in ["rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
                "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
                "monthly_mean", "monthly_max"]:
        future[col] = prophet_train[col].iloc[-1]

    # Generate predictions for the entire future period
    future_forecast = model.predict(future)
    
    # Filter predictions for the target month
    monthly_forecast = future_forecast[
        (future_forecast["ds"] >= month_start) & 
        (future_forecast["ds"] <= month_end)
    ].copy()
    
    if monthly_forecast.empty:
        return {"error": "No forecast available for the specified month."}

    # Extract daily water area predictions for the month
    daily_water_areas = monthly_forecast["yhat"].tolist()
    
    # Calculate monthly risk assessment
    monthly_risk_data = calculate_monthly_risk(daily_water_areas)
    
    # Calculate monthly statistics
    monthly_stats = {
        "average_water_area": float(round(np.mean(daily_water_areas), 2)),
        "max_water_area": float(round(np.max(daily_water_areas), 2)),
        "min_water_area": float(round(np.min(daily_water_areas), 2)),
        "std_water_area": float(round(np.std(daily_water_areas), 2))
    }

    # Generate monthly weather predictions
    predicted_temperature = predicted_humidity = predicted_rainfall = None
    if temperature_model:
        temp_forecast = temperature_model.predict(pd.DataFrame({"ds": [month_start, month_end]}))
        predicted_temperature = float(round(temp_forecast["yhat"].mean(), 2))
    if humidity_model:
        hum_forecast = humidity_model.predict(pd.DataFrame({"ds": [month_start, month_end]}))
        predicted_humidity = float(round(hum_forecast["yhat"].mean(), 2))
    if rainfall_model:
        rain_forecast = rainfall_model.predict(pd.DataFrame({"ds": [month_start, month_end]}))
        predicted_rainfall = float(round(rain_forecast["yhat"].mean(), 2))

    # Prepare chart data for the month
    monthly_forecast["date"] = monthly_forecast["ds"].dt.strftime("%b %d")
    chart_data = monthly_forecast[["date", "yhat"]].rename(columns={"yhat": "value"}).to_dict(orient="records")

    # Get feature importance for mid-month date
    mid_month_date = month_start + pd.Timedelta(days=15)
    feature_importance = explain_prediction_with_lime(model, future, future_forecast, prophet_train, mid_month_date)

    return {
        "month": f"{target_year}-{target_month:02d}",
        "month_name": month_start.strftime("%B %Y"),
        "monthly_risk_level": monthly_risk_data["monthly_risk"],
        "risk_breakdown": monthly_risk_data["risk_breakdown"],
        "alerts": monthly_risk_data["alerts"],
        "monthly_statistics": monthly_stats,
        "predicted_temperature": predicted_temperature,
        "predicted_humidity": predicted_humidity,
        "predicted_rainfall": predicted_rainfall,
        "chart_data": chart_data,
        "total_days_in_month": len(daily_water_areas),
        "XAI_Feature_Importance": feature_importance,
        
        # Keep some backward compatibility
        "date": str(user_input_date.date()),
        "predicted_water_area_km2": monthly_stats["average_water_area"],
        "flood_warning": monthly_risk_data["monthly_risk"],
        "risk_level": monthly_risk_data["monthly_risk"],
        "current_water_area_km2": monthly_stats["average_water_area"],
        "rainfall_mm": predicted_rainfall or 0
    }

from lime.lime_tabular import LimeTabularExplainer
from sklearn.linear_model import LinearRegression

def explain_prediction_with_lime(model, future_df, forecast_df, prophet_train, date_to_explain):
    import numpy as np
    import pandas as pd
    from lime.lime_tabular import LimeTabularExplainer

    user_input_date = pd.to_datetime(date_to_explain)
    forecast_for_date = forecast_df[forecast_df["ds"] == user_input_date]
    
    if forecast_for_date.empty:
        # If exact date not found, find closest date
        closest_idx = np.argmin(np.abs(forecast_df["ds"] - user_input_date))
        idx = closest_idx
    else:
        idx = forecast_for_date.index[0]

    feature_cols = [
        "Average_Temperature", "Rainfall", "Average_Humidity", "Max_Humidity", "Max_Temperature",
        "lag1", "lag3", "lag7", "lag14",
        "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
        "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
        "month_sin", "month_cos", "day_sin", "day_cos",
        "monthly_mean", "monthly_max"
    ]

    X = future_df[feature_cols].fillna(0).to_numpy()
    y = forecast_df["yhat"].values

    def predict_fn(inputs):
        temp_df = pd.DataFrame(inputs, columns=feature_cols)
        temp_df["ds"] = [future_df["ds"].iloc[idx]] * len(temp_df)
        preds = model.predict(temp_df)
        return preds["yhat"].values

    explainer = LimeTabularExplainer(
        training_data=X,
        feature_names=feature_cols,
        mode='regression'
    )

    explanation = explainer.explain_instance(
        data_row=X[idx],
        predict_fn=predict_fn,
        num_features=15
    )

    # Get raw feature importances (index-based, no thresholds)
    feature_importances = {
        feature_cols[feature_idx]: float(weight)
        for feature_idx, weight in explanation.local_exp[1]
        if feature_cols[feature_idx] not in ["month_sin", "month_cos", "day_sin", "day_cos"]
    }

    # Get top 3 by absolute importance
    top_3 = dict(sorted(feature_importances.items(), key=lambda x: abs(x[1]), reverse=True)[:3])
    return top_3