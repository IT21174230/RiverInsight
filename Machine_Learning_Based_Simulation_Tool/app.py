from flask import Flask, request, jsonify
import atexit
import os
import shutil
import json
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from numpyencoder import NumpyEncoder
from werkzeug.exceptions import HTTPException
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import clear_images, send_map_to_api
from utils.com_cache import m_cache, init_cache
from utils.riverbank_erosion import load_resources, prepare_future_input, make_predictions
from utils.riverbank_erosion_xai import generate_heatmap_with_timesteps
from utils.simulation_tool import load_resource_simulation , make_prediction_simulation, prepare_future_input_simulation
from utils.simulation_tool_xai import *

# Flask constructor takes the name of 
# current module (__name__) as argument.
app = Flask(__name__)
init_cache(app)

# Load resources (model and scalers) globally for riverbank erosion
model, scaler_ts, scaler_year = load_resources()

#load model for simulation
simulation_model, scaler_features, scaler_targets = load_resource_simulation()

def clean_up():
    IMAGE_FOLDER = r'data_dir\meander_migration_sal_maps'
    if os.path.exists(IMAGE_FOLDER):
        shutil.rmtree(IMAGE_FOLDER)  
        print(f"Cleared all images in {IMAGE_FOLDER}")
    
    # Clear cache
    m_cache.clear()
    print("Cleared all cache")
    
atexit.register(clean_up)

# Existing routes
@app.route('/')
def homepage():
    return 'Homepage'

@app.get('/meander_migration/params/')
def predict_meander():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    df = return_to_hp(y, q)
    try:
        return df.to_html()
    except:
        return df

@app.get('/meander_migration/params/explain_migration/')
def get_saliency():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    map_idx = int(query['idx'])
    t = send_map_to_api(y, q, map_idx)
    return t

# New route for riverbank erosion prediction
@app.route('/predict_erosion', methods=['POST'])
def predict():
    try:
        # Parse input JSON
        data = request.get_json()
        year = data.get('year')
        quarter = data.get('quarter')

        if year is None or quarter is None:
            return jsonify({'error': 'Missing year or quarter in the request.'}), 400

        # Prepare input features and make predictions
        future_X = prepare_future_input(year, quarter, scaler_year)
        predictions = make_predictions(model, scaler_ts, future_X)

        # Prepare response
        return jsonify({'year': year, 'quarter': quarter, 'predictions': predictions}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# New route for generating heatmap
@app.route('/predict_erosion/heatmap', methods=['GET'])
def predict_heatmap():
    try:
        # Parse input parameters
        query = request.args.to_dict()
        start_year = int(query['year'])
        start_quarter = int(query['quarter'])
        points = list(map(int, query.get('points', '').split(',')))  # Example: "1,5,10,20"
        timesteps = int(query.get('timesteps', 5))  # Default to 5 timesteps if not provided

        # Generate the heatmap
        heatmap_image = generate_heatmap_with_timesteps(model, start_year, start_quarter, scaler_year, points, timesteps)

        # Return the heatmap image as a base64 string
        return jsonify({'heatmap': heatmap_image}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# New route for simulation tool prediction
@app.route('/predict_simulation_tool', methods=['POST'])
def predict():
    try:
        # Parse input data
        input_data = request.get_json()
        date = input_data.get('date')
        rainfall = input_data.get('rainfall')
        temp = input_data.get('temp')

        print('date: ', date, 'rainfall: ', rainfall, 'temp: ', temp)

        # Prepare input features
        future_X = prepare_future_input_simulation(date, rainfall, temp)

        # Make predictions
        predictions_df = make_prediction_simulation(simulation_model, future_X, scaler_features, scaler_targets)

        # Calculate SHAP feature importance
        feature_names = ['year', 'quarter', 'rainfall', 'temperature']
        target_names = ['c1_dist','c2_dist','c3_dist','c4_dist','c5_dist','c6_dist','c7_dist','c8_dist'] 
        feature_importance = calculate_shap_feature_importance(simulation_model, future_X, feature_names)

        feature_importance_per_target = calculate_shap_feature_importance_per_target(
            model=simulation_model,
            data=future_X,
            feature_names=feature_names,
            target_names=target_names
        )

        # Prepare response
        response = {
            "predictions": predictions_df.to_dict(orient='records'),
            "feature_importance": feature_importance,
            "feature_importance_per_target": feature_importance_per_target

        }
        return jsonify(response), 200

    except HTTPException:
        return jsonify({"message": "Unsupported Media Type: Send request as encoded JSON"}), 415
    except KeyError as e:
        return jsonify({"message": f"{e} - Key not found in request body"}), 404
    except ValueError as e:
        return jsonify({"message": f"{e} - Request body input is invalid"}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500  
if __name__ == '__main__':
    app.run(debug=True)
