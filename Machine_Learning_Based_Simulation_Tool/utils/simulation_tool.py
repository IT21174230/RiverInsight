from flask import Flask, request
import pickle as pkl
import pandas as pd
import json
import numpy as np
from numpyencoder import NumpyEncoder
from datetime import datetime
from werkzeug.exceptions import HTTPException
import joblib
import os

# global model
# with open('Machine_Learning_Based_Simulation_Tool/model/riverinsight_simulation_model.pkl', 'rb') as f:
#     model = pkl.load(f)

# MODEL_PATH = r'Machine_Learning_Based_Simulation_Tool\model\riverinsight_simulation_ML_model.pkl'

# SCALER_FEATURES_PATH = r'Machine_Learning_Based_Simulation_Tool\data_dir\scaler_rain_temp_simulation.pkl'
# SCALER_TARGETS_PATH = r'Machine_Learning_Based_Simulation_Tool\data_dir\scaler_targets_simulation.pkl'

# latitudes=r'Machine_Learning_Based_Simulation_Tool\data_dir\y_coords_7.5m.npy'
# longitudes=r'Machine_Learning_Based_Simulation_Tool\data_dir\x_coords_7.5m.npy'

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
latitudes_path = os.path.join(BASE_DIR, 'data_dir', 'y_coords_7.5m.npy')
longitudes_path = os.path.join(BASE_DIR, 'data_dir', 'x_coords_7.5m.npy')

MODEL_PATH = os.path.join(BASE_DIR, 'model', 'riverinsight_simulation_ML_model.pkl')
SCALER_FEATURES_PATH = os.path.join(BASE_DIR, 'data_dir', 'scaler_rain_temp_simulation.pkl')
SCALER_TARGETS_PATH = os.path.join(BASE_DIR, 'data_dir', 'scaler_targets_simulation.pkl')

latitudes=np.load(latitudes_path)
longitudes=np.load(longitudes_path)

x1, y1 = 497, 305
x2, y2 = 513, 298


m = (y2 - y1) / (x2 - x1)
c = y1 - m * x1


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

# def generate_quarters_range(input_date):
#     """
#     Generate a list of quarters from 2025-Q1 to the input date's quarter.
#     """
#     input_date = datetime.strptime(input_date, '%Y-%m-%d')
#     input_year = input_date.year
#     input_quarter = (input_date.month - 1) // 3 + 1

#     quarters = []
#     for year in range(2025, input_year + 1):
#         start_quarter = 1 if year > 2025 else 1  # Start from Q1 for 2025
#         end_quarter = input_quarter if year == input_year else 4  # End at input quarter for the input year

#         for quarter in range(start_quarter, end_quarter + 1):
#             quarters.append((year, quarter))
    
#     return quarters

# def prepare_future_input_simulation(date, rainfall, temp):
#     """
#     Prepare input data for the model.
#     """
#     quarters = generate_quarters_range(date)
#     data = []

#     for year, quarter in quarters:
#         row = {
#             'date': pd.to_datetime(f'{year}-{quarter * 3 - 2}-01'),  # Start of the quarter
#             'year': year,
#             'quarter': quarter,
#             'rainfall': float(rainfall),
#             'temperature': float(temp)
#         }
#         data.append(row)

#     data_df = pd.DataFrame(data)
#     print("Input DataFrame before scaling:\n", data_df)
#     return data_df

def prepare_future_input_simulation_year_quarter(input_year, input_quarter, rainfall, temp):
    """
    Generate quarters from 2025-Q1 to input_year-input_quarter.
    Prepare dataframe for simulation inputs.
    """
    quarters = []
    for year in range(2025, input_year + 1):
        start_q = 1
        end_q = input_quarter if year == input_year else 4
        for q in range(start_q, end_q + 1):
            quarters.append((year, q))

    data = []
    for year, quarter in quarters:
        row = {
            'year': year,
            'quarter': quarter,
            'rainfall': float(rainfall),
            'temperature': float(temp),
            'date': pd.to_datetime(f'{year}-{quarter * 3 - 2}-01')  # Keep for compatibility
        }
        data.append(row)

    data_df = pd.DataFrame(data)
    return data_df

def get_perpendicular_point(known_coord, d_shift):
    """
    Calculate the new coordinate based on a known coordinate and a shift value.
    """
    shifted_coord = d_shift + known_coord
    return shifted_coord

def get_coordinates(x_pix, y_pix):
    """
    Convert pixel coordinates (x, y) to latitude and longitude.
    """
    lat = latitudes[x_pix, y_pix]
    long = longitudes[x_pix, y_pix]
    return (lat, long)
    

def get_raw_predictions(predictions_df):
    """
    Calculate the new centerline points and their coordinates based on raw predictions.
    """
    control_points_std = [[248, 309], [236, 309], [409, 330], [409, 344], [533, 374], [548, 383], [497, 305], [513, 298]]
    
    # Extract the latest prediction row
    latest_infer = predictions_df.iloc[-1][['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']].to_dict()

    new_centerline_points = {}
    centerline_coordinates = []

    index_mapping = {
        0: lambda l: [get_perpendicular_point(control_points_std[0][1], l), control_points_std[0][1]],
        1: lambda l: [get_perpendicular_point(control_points_std[1][1], l), control_points_std[1][1]],
        2: lambda l: [control_points_std[2][0], get_perpendicular_point(control_points_std[2][0], l)],
        3: lambda l: [control_points_std[3][0], get_perpendicular_point(control_points_std[3][0], l)]
    }

    for i, l in enumerate(latest_infer.values()):
        if i in index_mapping:
            new_centerline_points[i] = index_mapping[i](l)

        if i == 4:
            x_m_1 = control_points_std[6][0] + np.sqrt(np.square(l) / np.square((1 + np.square(m))))
            x_m_2 = control_points_std[6][0] - np.sqrt(np.square(l) / np.square((1 + np.square(m))))
            xm = 0
            if x_m_1 < x_m_2:
                xm = np.abs(x_m_1)
            else:
                xm = np.abs(x_m_2)

            y_m_1 = control_points_std[6][1] + ((l * m) / np.sqrt(np.square(m) + 1))
            y_m_2 = control_points_std[6][1] + ((l * m) / np.sqrt(np.square(m) + 1))
            ym = 0
            if y_m_1 < y_m_2:
                ym = np.abs(y_m_1)
            else:
                ym = np.abs(y_m_2)

            new_centerline_points[i] = [xm, ym]

        if i == 5:
            x_m_1 = control_points_std[7][0] + np.sqrt(np.square(l) / np.square((1 + np.square(m))))
            x_m_2 = control_points_std[7][0] - np.sqrt(np.square(l) / np.square((1 + np.square(m))))
            xm = 0
            if x_m_1 < x_m_2:
                xm = np.abs(x_m_1)
            else:
                xm = np.abs(x_m_2)

            y_m_1 = control_points_std[7][1] + ((l * m) / np.sqrt(np.square(m) + 1))
            y_m_2 = control_points_std[7][1] + ((l * m) / np.sqrt(np.square(m) + 1))
            ym = 0
            if y_m_1 < y_m_2:
                ym = np.abs(y_m_1)
            else:
                ym = np.abs(y_m_2)

            new_centerline_points[i] = [xm, ym]

    for i in new_centerline_points.values():
        centerline_coordinates.append(get_coordinates(int(i[0]), int(i[1])))

    return centerline_coordinates

def make_prediction_simulation(model, future_X, scaler_features, scaler_targets):
    """
    Make predictions using the model, convert predictions to meters, and remove predictions 5 and 6.
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
    unscaled_predictions = scaler_targets.inverse_transform(scaled_predictions)
    
    # Convert predictions to meters
    transformed_predictions = (unscaled_predictions / 12) * 0.625
    
    # Add predictions to the DataFrame
    prediction_columns = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']
    for i, col in enumerate(prediction_columns):
        future_X[col] = transformed_predictions[:, i]
    
    # Calculate bend values
    future_X['bend_1'] = np.abs((future_X['c1_dist'] - future_X['c2_dist']).astype(float).round(4))
    future_X['bend_2'] = np.abs((future_X['c3_dist'] - future_X['c4_dist']).astype(float).round(4))
    future_X['bend_3'] = np.abs((future_X['c7_dist'] - future_X['c8_dist']).astype(float).round(4))
    
    # Round and convert the specified columns to float
    future_X[['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']] = future_X[['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']].astype(float).round(4)

    # Calculate centerline coordinates using helper functions
    centerline_coordinates = get_raw_predictions(future_X)
    
    # Add centerline coordinates to the DataFrame
    future_X['centerline_coordinates'] = [centerline_coordinates] * len(future_X)
    
    return future_X