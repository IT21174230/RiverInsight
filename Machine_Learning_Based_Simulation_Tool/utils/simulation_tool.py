from flask import Flask, request
import pickle as pkl
import pandas as pd
import json
import numpy as np
from numpyencoder import NumpyEncoder
from datetime import datetime
from werkzeug.exceptions import HTTPException
import joblib

# global model
# with open('Machine_Learning_Based_Simulation_Tool/model/riverinsight_simulation_model.pkl', 'rb') as f:
#     model = pkl.load(f)

MODEL_PATH = r'Machine_Learning_Based_Simulation_Tool\model\riverinsight_simulation_ML_model.pkl'

SCALER_FEATURES_PATH = r'Machine_Learning_Based_Simulation_Tool\data_dir\scaler_rain_temp_simulation.pkl'
SCALER_TARGETS_PATH = r'Machine_Learning_Based_Simulation_Tool\data_dir\scaler_targets_simulation.pkl'

def load_resource_simulation():
    with open(MODEL_PATH, 'rb') as f:
        model = pkl.load(f)

    # Load the feature scaler
    with open(SCALER_FEATURES_PATH, 'rb') as f:
        scaler_features = joblib.load(f)
        # print("Loaded scaler_features type:", type(scaler_features))  # Debugging
    
    # Load the target scaler
    with open(SCALER_TARGETS_PATH, 'rb') as f:
        scaler_targets = joblib.load(f)
        # print("Loaded scaler_targets type:", type(scaler_targets))  # Debugging
    
    return model, scaler_features, scaler_targets

# def set_quarter_flags(df):
#     # Create a dictionary of quarters with False values
#     quarter_flags = {f'quarter_{i}': False for i in range(2, 5)}
    
#     # Update the respective quarter flag based on the quarter value
#     for i in range(2, 5):
#         quarter_flag_column = f'quarter_{i}'
#         df[quarter_flag_column] = df['quarter'].apply(lambda x: True if int(x) == i else False)
#     return df

def generate_quarters_range(input_date):
    """
    Generate a list of quarters from 2025-Q1 to the input date's quarter.
    """
    input_date = datetime.strptime(input_date, '%Y-%m-%d')
    input_year = input_date.year
    input_quarter = (input_date.month - 1) // 3 + 1

    quarters = []
    for year in range(2025, input_year + 1):
        start_quarter = 1 if year > 2025 else 1  # Start from Q1 for 2025
        end_quarter = input_quarter if year == input_year else 4  # End at input quarter for the input year

        for quarter in range(start_quarter, end_quarter + 1):
            quarters.append((year, quarter))
    
    return quarters

def prepare_future_input_simulation(date, rainfall, temp):
    """
    Prepare input data for the model.
    """
    quarters = generate_quarters_range(date)
    data = []

    for year, quarter in quarters:
        row = {
            'date': pd.to_datetime(f'{year}-{quarter * 3 - 2}-01'),  # Start of the quarter
            'year': year,
            'quarter': quarter,
            'rainfall': float(rainfall),
            'temperature': float(temp)
        }
        data.append(row)

    data_df = pd.DataFrame(data)
    print("Input DataFrame before scaling:\n", data_df)
    return data_df

# def prepare_future_input_simualtion(date, rainfall, temp):
#     data =  {'date': pd.to_datetime(date)}
#     # date = pd.PeriodIndex(date, freq='M').to_timestamp()
#     # Extract 'year' and calculate 'quarter'
#     data['year'] = int(data['date'].year)
#     data['quarter'] = str(((data['date'].month - 1) // 3) + 1)

#     # Create a new column combining 'year' and 'quarter'
#     # data['year_quarter'] = str(data['year']) + '-' + str(data['quarter'])
#     data['rainfall'] = float(rainfall)
#     data['temperature'] = float(temp)

#     data_df = pd.DataFrame(data, index=[0])
#     # print(data_df)
#     return data_df

# def make_prediction_simulation(model, future_X, scaler_features, scaler_targets):
#     features = ['year','quarter', 'rainfall', 'temperature']
#     # Ensure all features are numeric
#     future_X[features] = future_X[features].apply(pd.to_numeric, errors='coerce')

#     # Scale the input features
#     scaled_features = scaler_features.transform(future_X[['rainfall', 'temperature']])
#     future_X[['rainfall', 'temperature']] = scaled_features
    
#     scaled_predictions = model.predict(future_X[features])

#     # Inverse scale the predictions to the original scale
#     predictions = scaler_targets.inverse_transform(scaled_predictions)
#     # print("Scaled Predictions:", scaled_predictions)
#     # print("Predictions (Original Scale):", predictions)
#     return predictions

def make_prediction_simulation(model, future_X, scaler_features, scaler_targets):
    """
    Make predictions using the model.
    """
    features = ['year', 'quarter', 'rainfall', 'temperature']
    
    # Ensure all features are numeric
    future_X[features] = future_X[features].apply(pd.to_numeric, errors='coerce')
    
    # Scale the input features
    scaled_features = scaler_features.transform(future_X[['rainfall', 'temperature']])
    future_X[['rainfall', 'temperature']] = scaled_features
    
    # Make predictions
    scaled_predictions = model.predict(future_X[features])
    
    # Inverse scale the predictions to the original scale
    predictions = scaler_targets.inverse_transform(scaled_predictions)
    
    # Add predictions to the DataFrame
    future_X['predictions'] = predictions.tolist()
    return future_X

