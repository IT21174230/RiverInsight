# routes.py
import pandas as pd
import numpy as np
from flask import request, jsonify

# Import from our local modules
from .models import (
    prophet_model, prophet_train, temperature_model,
    humidity_model, rainfall_model, FLOOD_THRESHOLD
)
from .utils_module import evaluation_metrics


def init_routes(app):
    """
    Attach the route(s) to the Flask `app` object.
    """

    @app.route("/predict", methods=["GET", "OPTIONS"])
    def get_prediction():
        # Handle the preflight OPTIONS request
        if request.method == "OPTIONS":
            return "", 200

        try:
            date_str = request.args.get("date")
            if not date_str:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

            user_input_date = pd.to_datetime(date_str)

            # Check if model loaded
            if prophet_model is None or prophet_train is None:
                return jsonify({"error": "No model available to make predictions."}), 500

            last_date = prophet_train["ds"].max()
            if user_input_date <= last_date:
                return jsonify({
                    "error": f"Input date must be after the last training date: {last_date.date()}"
                }), 400

            # Forecast days
            forecast_days = (user_input_date - last_date).days
            future = prophet_model.make_future_dataframe(periods=forecast_days, freq="D")

            # Basic date-based features
            future["month"] = future["ds"].dt.month
            future["day_of_year"] = future["ds"].dt.dayofyear
            future["month_sin"] = np.sin(2 * np.pi * future["month"] / 12)
            future["month_cos"] = np.cos(2 * np.pi * future["month"] / 12)
            future["day_sin"] = np.sin(2 * np.pi * future["day_of_year"] / 365)
            future["day_cos"] = np.cos(2 * np.pi * future["day_of_year"] / 365)

            # Simulate future regressor values via monthly averages in training
            regressors_to_simulate = [
                "Average_Temperature", "Rainfall", "Average_Humidity",
                "Max_Humidity", "Max_Temperature", "Average_Wind_Speed", "Max_Wind_Speed"
            ]
            for reg in regressors_to_simulate:
                if reg in prophet_train.columns:
                    monthly_avg = prophet_train.groupby(prophet_train["ds"].dt.month)[reg].mean().to_dict()
                    future[reg] = future["ds"].dt.month.map(monthly_avg)

            # Lag features: use the last observed water_area_km2
            last_value = prophet_train["y"].iloc[-1]
            for lag_reg in ["lag1", "lag3", "lag7", "lag14"]:
                if lag_reg in prophet_train.columns:
                    future[lag_reg] = last_value

            # Rolling/cumulative columns: use last known values
            for col in [
                "rolling_avg_7", "rolling_median_7", "rolling_std_7", "expanding_mean",
                "cumulative_rainfall", "rainfall_ndwi_interaction", "extreme_rainfall",
                "monthly_mean", "monthly_max"
            ]:
                if col in prophet_train.columns:
                    future[col] = prophet_train[col].iloc[-1]

            # Run model prediction
            future_forecast = prophet_model.predict(future)
            forecast_for_date = future_forecast[future_forecast["ds"] == user_input_date]
            if forecast_for_date.empty:
                return jsonify({"error": "No forecast available for that date."}), 404

            row = forecast_for_date.iloc[0]
            water_area = row["yhat"]

            # =============== DYNAMIC FLOOD THRESHOLD LOGIC ===============
            flood_threshold = FLOOD_THRESHOLD if FLOOD_THRESHOLD else 9.0
            if water_area < 0.8 * flood_threshold:
                risk_level = "Low Risk"
                alerts = ["No flood warning", "Continue normal activities"]
            elif water_area < flood_threshold:
                risk_level = "Moderate Risk"
                alerts = ["Flood risk moderate", "Be cautious", "Monitor water levels"]
            else:
                risk_level = "High Risk"
                alerts = ["Flood warning issued", "Evacuate if necessary", "Seek higher ground"]
            # =============================================================

            # Additional parameter predictions
            predicted_temperature = None
            predicted_humidity = None
            predicted_rainfall = None
            predicted_wind_speed = None

            # Temperature
            if temperature_model is not None:
                temp_forecast = temperature_model.predict(pd.DataFrame({"ds": [user_input_date]}))
                predicted_temperature = float(round(temp_forecast.iloc[0]["yhat"], 2))

            # Humidity
            if humidity_model is not None:
                hum_forecast = humidity_model.predict(pd.DataFrame({"ds": [user_input_date]}))
                predicted_humidity = float(round(hum_forecast.iloc[0]["yhat"], 2))

            # Rainfall
            if rainfall_model is not None:
                rain_forecast = rainfall_model.predict(pd.DataFrame({"ds": [user_input_date]}))
                predicted_rainfall = float(round(rain_forecast.iloc[0]["yhat"], 2))

            # Wind speed (simple monthly average)
            if "Average_Wind_Speed" in prophet_train.columns:
                avg_ws_by_month = prophet_train.groupby(prophet_train["ds"].dt.month)["Average_Wind_Speed"].mean().to_dict()
                predicted_wind_speed = float(round(avg_ws_by_month.get(user_input_date.month, 0), 2))

            # Prepare chart data for year-to-date
            year_start = pd.Timestamp(year=user_input_date.year, month=1, day=1)
            chart_df = future_forecast[
                (future_forecast["ds"] >= year_start) &
                (future_forecast["ds"] <= user_input_date)
            ].copy()
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
                "predicted_wind_speed": predicted_wind_speed,
                "current_water_area_km2": float(round(water_area, 2)),
                "rainfall_mm": predicted_rainfall if predicted_rainfall else 0,
                "prediction_interval": {
                    "lower": float(round(row["yhat_lower"], 2)),
                    "upper": float(round(row["yhat_upper"], 2))
                },
                "chart_data": chart_data,
                "evaluation_metrics": evaluation_metrics,
                "explainable_factor": {
                    "explanation": "The flood risk is driven by rising water levels and heavy rainfall."
                },
                "flood_effect": {
                    "land_cover_effect": "Significant impact on vegetation and soil erosion.",
                    "land_usage_effect": "Urban and agricultural areas may face disruption.",
                    "effect_explanation": "Flooding can result in long-term changes in land cover and economic losses."
                }
            }

            # Log to console
            print(f"GET /predict request for date: {user_input_date.date()}")
            # print("Training Evaluation Metrics:")
            # print(f"MAE: {evaluation_metrics.get('mae_train', None):.2f}, "
            #       f"RMSE: {evaluation_metrics.get('rmse_train', None):.2f}, "
            #       f"R²: {evaluation_metrics.get('r2_train', None):.2f}")

            # print("Test Evaluation Metrics:")
            # print(f"MAE: {evaluation_metrics.get('mae_test', None):.2f}, "
            #       f"RMSE: {evaluation_metrics.get('rmse_test', None):.2f}, "
            #       f"R²: {evaluation_metrics.get('r2_test', None):.2f}")

            return jsonify(result)

        except Exception as e:
            return jsonify({"error": str(e)}), 500