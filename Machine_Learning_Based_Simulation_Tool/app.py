from flask import Flask, request, jsonify
import atexit
import os
import shutil
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import send_map_to_api
from utils.com_cache import m_cache, data_cache, init_cache
from utils.riverbank_erosion import load_resources, prepare_future_input, make_predictions, generate_feature_sensitivity_heatmap
from utils.riverbank_erosion_xai import generate_heatmap_with_timesteps
from utils.FloodLogic import load_model, flood_prediction_logic
from utils.simulation_tool import load_resource_simulation , make_prediction_simulation, prepare_future_input_simulation
from utils.simulation_tool_xai import *
from flask import send_from_directory
from flask_cors import CORS
import traceback

# Flask constructor takes the name of current module (__name__) as argument.
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)
init_cache(app)

# Load resources (model and scalers) globally for riverbank erosion
model, scalers, feature_cols,model_1, scaler_ts, scaler_year = load_resources()

# load resources 4 flood prediction
prophet_model, prophet_train, temp_model, hum_model, rain_model = load_model()

#load model for simulation
simulation_model, scaler_features, scaler_targets = load_resource_simulation()

def clean_up():
    IMAGE_FOLDER = r'data_dir\meander_migration_sal_maps'
    if os.path.exists(IMAGE_FOLDER):
        shutil.rmtree(IMAGE_FOLDER)  
        print(f"Cleared all images in {IMAGE_FOLDER}")
    
    # Clear cache
    m_cache.clear()
    data_cache.clear()
    print("Cleared all cache")
    
atexit.register(clean_up)
 
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
        return jsonify(df.to_dict(orient="records"))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.get('/meander_migration/params/explain_migration/')
def get_saliency():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    map_idx = int(query['idx'])
    map = send_map_to_api(y, q, map_idx)
    return map

# @app.get('/meander_migration/params/get_point_values/')
# def get_raw_point_vals():
#     query = request.args.to_dict()
#     y = int(query['year'])
#     q = int(query['quart'])
#     raw_df = get_raw_predictions(y, q)
#     try:
#         return jsonify(raw_df.to_dict(orient="records"))
#     except:
#         return jsonify(raw_df)

# New route for riverbank erosion prediction
@app.route("/predict_erosion", methods=["POST"])
def predict_erosion():
    try:
        data = request.get_json(force=True)

        # required
        year     = int(data.get("year"))
        quarter  = int(data.get("quarter"))
        rainfall = float(data.get("rainfall"))
        temperature = float(data.get("temperature"))

        missing = [k for k in ("year", "quarter", "rainfall", "temperature")
                   if data.get(k) is None]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        X = prepare_future_input(year, quarter, rainfall, temperature)
        preds = make_predictions(X)

        return jsonify({
            "year"        : year,
            "quarter"     : quarter,
            "rainfall"    : rainfall,
            "temperature" : temperature,
            "predictions" : preds
        }), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.route("/predict_erosion/heatmap", methods=["POST"])
def predict_heatmap():
    try:
        data = request.get_json(force=True)

        year         = int(data["year"])
        quarter      = int(data["quarter"])
        points       = list(map(int, data.get("points", [])))
        timesteps    = int(data.get("timesteps", 5))

        if not points:
            return jsonify({"error": "points must be a non-empty list"}), 400

        # Generate heatmap
        b64_png = generate_heatmap_with_timesteps(
            model=model_1,
            start_year=year,
            start_quarter=quarter,
            scaler_year=scaler_year,
            points=points,
            timesteps=timesteps
        )

        return jsonify({
            "year": year,
            "quarter": quarter,
            "points": points,
            "timesteps": timesteps,
            "heatmap_png_base64": b64_png
        }), 200

    except Exception as exc:
        return jsonify({"error": str(exc), "trace": traceback.format_exc()}), 500
    
# New route for simulation tool prediction
@app.route('/predict_simulation_tool', methods=['POST'])
def predict():
    try:
        # Parse input data
        input_data = request.get_json()
        date = input_data.get('date')
        rainfall = input_data.get('rainfall')
        temp = input_data.get('temp')

        # Prepare input features
        future_X = prepare_future_input_simulation(date, rainfall, temp)

        # Make predictions
        predictions_df = make_prediction_simulation(simulation_model, future_X, scaler_features, scaler_targets)

        # Calculate SHAP feature importance
        feature_names = ['year', 'quarter', 'rainfall', 'temperature']
        target_names = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']
        feature_importance = calculate_shap_feature_importance(simulation_model, future_X, feature_names)

        # Calculate SHAP feature importance per target and generate heatmap URL
        feature_importance_per_target, heatmap_url = calculate_shap_feature_importance_per_target(
            model=simulation_model,
            data=future_X,
            feature_names=feature_names,
            target_names=target_names
        )

        # Prepare response
        response = {
            "predictions": predictions_df.to_dict(orient='records'),
            "feature_importance": feature_importance,
            "feature_importance_per_target": feature_importance_per_target,
            "heatmap_url": heatmap_url,  # Return the base64-encoded image URL
            "centerline_coordinates": predictions_df['centerline_coordinates'].iloc[0]  # Add centerline coordinates
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


# ------------------------------------------------------------------
#  HISTORICAL VALUES  –  width (or erosion) for every quarter
# ------------------------------------------------------------------
@app.route("/predict_erosion/history", methods=["POST"])
def get_erosion_history():
    try:
        d = request.get_json(force=True)

        start_year     = int(d.get("startYear", 2025))
        start_quarter  = int(d.get("startQuarter", 1))
        end_year       = int(d["endYear"])
        end_quarter    = int(d["endQuarter"])

        # use same R/T for the whole span (simplest); you could vary per year
        rainfall       = float(d.get("rainfall",     0.35))
        temperature    = float(d.get("temperature", 301.8))

        if start_year > end_year or (
            start_year == end_year and start_quarter > end_quarter
        ):
            return jsonify({"error": "start date must be ≤ end date"}), 400

        history_data = []
        y, q = start_year, start_quarter
        while (y < end_year) or (y == end_year and q <= end_quarter):
            X = prepare_future_input(y, q, rainfall, temperature)
            preds = make_predictions(X)          # {"Point_1": …, …}

            for pt, val in preds.items():
                history_data.append({
                    "point": pt,
                    "year":  y,
                    "quarter": q,
                    "value": round(val * 0.625, 3)   # scale + nice rounding
                })

            # step to next quarter
            q += 1
            if q > 4:
                q = 1
                y += 1

        return jsonify({"history": history_data}), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    
@app.route("/predict/flooding", methods=["GET"])
def get_prediction():
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "Missing date parameter"}), 400

    result = flood_prediction_logic(date, prophet_model, prophet_train, temp_model, hum_model, rain_model)

    if "error" in result:
        return jsonify(result), 400 if "format" in result["error"] else 404
    return jsonify(result)

 

if __name__ == '__main__':
    app.run(debug=True)