import numpy as np
import pandas as pd
from keras.models import load_model
from keras.losses import MeanSquaredError
import joblib

# Paths to resources
MODEL_PATH = r'model\erosion_neural_network_model.h5'
SCALER_TS_PATH = r'data_dir\erosion_scaler_ts.pkl'
SCALER_YEAR_PATH = r'data_dir\scaler_year.pkl'

# Load resources
def load_resources():
    model = load_model(MODEL_PATH, custom_objects={'mse': MeanSquaredError()})
    scaler_ts = joblib.load(SCALER_TS_PATH)
    scaler_year = joblib.load(SCALER_YEAR_PATH)
    return model, scaler_ts, scaler_year

# Prepare input features
def prepare_future_input(year, quarter, scaler_year):
    future_df = pd.DataFrame({
        'year': [year],
        'quarter': [quarter]
    })

    # Add time features
    future_df['quarter_sin'] = np.sin(2 * np.pi * future_df['quarter'] / 4)
    future_df['quarter_cos'] = np.cos(2 * np.pi * future_df['quarter'] / 4)
    future_df['year_scaled'] = scaler_year.transform(future_df[['year']])
    future_df['year_scaled_amplified'] = future_df['year_scaled'] * 10
    future_df['year_quarter_interaction'] = future_df['year_scaled_amplified'] * (
        future_df['quarter_sin'] + future_df['quarter_cos'])

    return future_df[['year_scaled_amplified', 'quarter_sin', 'quarter_cos', 'year_quarter_interaction']]

# Make predictions
def make_predictions(model, scaler_ts, future_X):
    prediction = model.predict(future_X)
    prediction_original = scaler_ts.inverse_transform(prediction)
    
    # Define target column names
    targets = [
        'Point_1', 'Point_2', 'Point_3', 'Point_4', 'Point_5', 'Point_6',
        'Point_7', 'Point_8', 'Point_9', 'Point_10', 'Point_11', 'Point_12',
        'Point_13', 'Point_14', 'Point_15', 'Point_16', 'Point_17', 'Point_18',
        'Point_19', 'Point_20', 'Point_21', 'Point_22', 'Point_23', 'Point_24', 'Point_25'
    ]

    return pd.DataFrame(prediction_original, columns=targets).to_dict(orient='records')