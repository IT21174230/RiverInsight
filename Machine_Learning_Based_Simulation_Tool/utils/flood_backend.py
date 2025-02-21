from fastapi import FastAPI, HTTPException
import pandas as pd
import numpy as np
import requests
import logging
from prophet import Prophet
from datetime import datetime, timedelta
import ee
import joblib

# Initialize FastAPI app
app = FastAPI()

# Logging configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Constants
ee.Authenticate()
ee.Initialize(project='')
WEATHER_BASE_URL = "https://archive-api.open-meteo.com/v1/era5"
RAINFALL_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Define Area of Interest (AOI)
LATITUDE = 7.62236
LONGITUDE = 79.87829
radius_km = 10

# Load the pre-trained Prophet model
prophet_model = joblib.load('prophet_model.pkl')

def fetch_historical_hourly_weather(date_str):
    logging.info(f"Fetching weather data for {date_str}")
    try:
        params = {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "start_date": date_str,
            "end_date": date_str,
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "timezone": "auto",
        }
        response = requests.get(WEATHER_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        hourly = data.get("hourly", {})
        if not hourly:
            logging.warning(f"No hourly data available for {date_str}")
            return None
        time_series = pd.DataFrame(hourly)
        return time_series
    except requests.exceptions.RequestException as e:
        logging.error(f"API Request Error for {date_str}: {e}")
        return None

def aggregate_hourly_to_daily(hourly_data):
    if hourly_data is not None and not hourly_data.empty:
        logging.info("Aggregating hourly data to daily summary")
        return {
            "Average_Temperature": hourly_data["temperature_2m"].mean(),
            "Max_Temperature": hourly_data["temperature_2m"].max(),
            "Average_Humidity": hourly_data["relative_humidity_2m"].mean(),
            "Max_Humidity": hourly_data["relative_humidity_2m"].max(),
            "Average_Wind_Speed": hourly_data["wind_speed_10m"].mean(),
            "Max_Wind_Speed": hourly_data["wind_speed_10m"].max(),
        }
    logging.warning("No data to aggregate")
    return {
        "Average_Temperature": None,
        "Max_Temperature": None,
        "Average_Humidity": None,
        "Max_Humidity": None,
        "Average_Wind_Speed": None,
        "Max_Wind_Speed": None,
    }

def get_rainfall_for_date(date_str):
    try:
        params = {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "start_date": date_str,
            "end_date": date_str,
            "daily": "precipitation_sum",
            "timezone": "auto",
        }

        logging.info(f"Fetching rainfall data for {date_str}")
        response = requests.get(RAINFALL_BASE_URL, params=params)
        response.raise_for_status()

        data = response.json()
        rainfall = data.get("daily", {}).get("precipitation_sum", [0])[0]
        return rainfall
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error for {date_str}: {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error for {date_str}: {e}")
        return None

def get_weather_parameters_for_date(date_str):
    # Fetch hourly weather data
    hourly_data = fetch_historical_hourly_weather(date_str)
    daily_summary = aggregate_hourly_to_daily(hourly_data)

    # Fetch rainfall data
    rainfall = get_rainfall_for_date(date_str)

    # Combine results
    weather_parameters = {
        'date': date_str,
        'Rainfall': rainfall,
        **daily_summary
    }

    return weather_parameters

# Helper function to fetch NDWI data
area_of_interest = ee.Geometry.Point([LONGITUDE, LATITUDE]).buffer(radius_km * 1000)


def get_ndwi_for_date(date_str):
    logging.info(f"Fetching NDWI data for {date_str}")

    # Convert string date to datetime object
    target_date = datetime.strptime(date_str, '%Y-%m-%d')

    # Initialize date ranges with smaller window first
    date_ranges = [
        (timedelta(days=3), timedelta(days=3)),
        (timedelta(weeks=1), timedelta(weeks=1)),
        (timedelta(weeks=2), timedelta(weeks=2)),
        (timedelta(weeks=4), timedelta(weeks=2)),
        (timedelta(weeks=8), timedelta(weeks=2))
    ]

    image = None
    used_date = None

    for before, after in date_ranges:
        logging.info(f"Searching in range: -{before} to +{after} from target date")

        start_date = target_date - before
        end_date = target_date + after

        # Get image collection for current date range
        s2_collection = ee.ImageCollection('COPERNICUS/S2') \
            .filterBounds(area_of_interest) \
            .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

        # Get list of available dates
        available_dates = s2_collection.aggregate_array('system:time_start').getInfo()

        if not available_dates:
            logging.info(f"No images found in current range, trying next range")
            continue

        # Convert timestamps to datetime objects
        available_dates = [datetime.fromtimestamp(ts / 1000) for ts in available_dates]

        # Sort dates by proximity to target date
        available_dates.sort(key=lambda x: abs((x - target_date).total_seconds()))

        # Try to get the closest date's image
        closest_date = available_dates[0]
        logging.info(f"Found closest date: {closest_date.strftime('%Y-%m-%d')}")

        image = s2_collection \
            .filterDate(closest_date.strftime('%Y-%m-%d')) \
            .first()

        if image.getInfo():
            used_date = closest_date.strftime('%Y-%m-%d')
            logging.info(f"Successfully found usable image from {used_date}")
            break

    # If no image found in any range, return zero values
    if not image or not used_date:
        logging.warning(f"No suitable images found for date {date_str} in any range")
        return {
            'date': date_str,
            'mean_ndwi': 0,
            'aoi_area_km2': 0,
            'water_area_km2': 0,
            'water_ratio': 0,
            'days_from_target': 0,
            'search_radius_days': 0
        }

    try:
        # Calculate AOI area (cached)
        aoi_area_dict = ee.Image.pixelArea().reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=area_of_interest,
            scale=30,
            maxPixels=1e9
        ).getInfo()

        aoi_area_km2 = list(aoi_area_dict.values())[0] / 1e6 if aoi_area_dict else 0

        # Calculate NDWI with optimized computation
        ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')

        # Compute all statistics in a single reduction
        stats = ndwi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=area_of_interest,
            scale=30,
            maxPixels=1e9
        ).getInfo()

        mean_ndwi = stats.get('NDWI', 0)

        # Calculate water area
        ndwi_mask = ndwi.gte(0)
        water_area = ndwi_mask.multiply(ee.Image.pixelArea()).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=area_of_interest,
            scale=30,
            maxPixels=1e9
        ).getInfo()

        ndwi_area_km2 = list(water_area.values())[0] / 1e6 if water_area else 0
        water_ratio = ndwi_area_km2 / aoi_area_km2 if aoi_area_km2 > 0 else 0

        # Calculate days difference from target
        days_diff = abs((datetime.strptime(used_date, '%Y-%m-%d') - target_date).days)

        return {
            'date': used_date,
            'mean_ndwi': mean_ndwi,
            'aoi_area_km2': aoi_area_km2,
            'water_area_km2': ndwi_area_km2,
            'water_ratio': water_ratio,
            'days_from_target': days_diff,
            'search_radius_days': (before.days + after.days) // 2
        }

    except Exception as e:
        logging.error(f'Error calculating NDWI data: {e}')
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating NDWI data: {str(e)}"
        )

def preprocess_and_predict(input_data):
    # Convert input data to a DataFrame
    data = pd.DataFrame([input_data])

    # Convert date to datetime if it's not already
    if isinstance(data['date'].iloc[0], str):
        data['date'] = pd.to_datetime(data['date'])

    # Encode date-related features
    data['month'] = data['date'].dt.month
    data['day_of_year'] = data['date'].dt.dayofyear
    data['month_sin'] = np.sin(2 * np.pi * data['month'] / 12)
    data['month_cos'] = np.cos(2 * np.pi * data['month'] / 12)
    data['day_sin'] = np.sin(2 * np.pi * data['day_of_year'] / 365)
    data['day_cos'] = np.cos(2 * np.pi * data['day_of_year'] / 365)

    # Handle missing values for lag features
    data['lag1'] = data['water_area_km2']
    data['lag3'] = data['water_area_km2']
    data['lag7'] = data['water_area_km2']
    data['lag14'] = data['water_area_km2']

    # Feature engineering
    data['rolling_avg_7'] = data['water_area_km2']
    data['rolling_median_7'] = data['water_area_km2']
    data['rolling_std_7'] = 0  # Default value for single point
    data['expanding_mean'] = data['water_area_km2']
    data['cumulative_rainfall'] = data['Rainfall']
    data['rainfall_ndwi_interaction'] = data['Rainfall'] * data['mean_ndwi']
    data['extreme_rainfall'] = (data['Rainfall'] > 0.95).astype(int)

    # Monthly aggregates
    data['month_year'] = data['date'].dt.to_period('M')
    data['monthly_mean'] = data['water_area_km2']
    data['monthly_max'] = data['water_area_km2']

    # Prepare data for Prophet
    prophet_data = data.rename(columns={'date': 'ds', 'water_area_km2': 'y'})

    # Define additional regressors
    additional_regressors = [
        'Average_Temperature', 'Rainfall', 'lag1', 'lag3', 'lag7', 'lag14',
        'rolling_avg_7', 'rolling_median_7', 'rolling_std_7', 'expanding_mean',
        'cumulative_rainfall', 'rainfall_ndwi_interaction', 'extreme_rainfall',
        'month_sin', 'month_cos', 'day_sin', 'day_cos',
        'monthly_mean', 'monthly_max', 'Average_Humidity', 'Max_Humidity',
        'Average_Wind_Speed', 'Max_Wind_Speed', 'Max_Temperature'
    ]

    for regressor in additional_regressors:
        if regressor in data.columns:
            prophet_data[regressor] = data[regressor]

    # Make predictions
    forecast = prophet_model.predict(prophet_data)
    return forecast['yhat'].values[0]

@app.get("/predict/")
async def get_prediction(date: str):
    try:
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid date format. Please use YYYY-MM-DD format."
            )

        # Fetch weather parameters
        weather_parameters = get_weather_parameters_for_date(date)
        if not weather_parameters['Rainfall']:
            raise HTTPException(
                status_code=404,
                detail="Weather data not available for the specified date"
            )

        # Fetch NDWI data
        ndwi_data = get_ndwi_for_date(date)
        if ndwi_data['water_area_km2'] == 0 and ndwi_data['mean_ndwi'] == 0:
            raise HTTPException(
                status_code=404,
                detail="Satellite data not available for the specified date"
            )

        # Combine data
        input_data = {
            'date': date,
            'water_area_km2': ndwi_data['water_area_km2'],
            'Rainfall': weather_parameters['Rainfall'],
            'Average_Temperature': weather_parameters['Average_Temperature'],
            'Max_Temperature': weather_parameters['Max_Temperature'],
            'Average_Humidity': weather_parameters['Average_Humidity'],
            'Max_Humidity': weather_parameters['Max_Humidity'],
            'Average_Wind_Speed': weather_parameters['Average_Wind_Speed'],
            'Max_Wind_Speed': weather_parameters['Max_Wind_Speed'],
            'mean_ndwi': ndwi_data['mean_ndwi']
        }

        # Predict
        prediction = preprocess_and_predict(input_data)

        # Check for flood warning
        flood_warning = prediction > 13.26

        return {
            "date": date,
            "predicted_water_area_km2": float(prediction),
            "flood_warning": bool(flood_warning),
            "current_water_area_km2": float(ndwi_data['water_area_km2']),
            "rainfall_mm": float(weather_parameters['Rainfall'])
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error processing prediction for date {date}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while processing prediction"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
