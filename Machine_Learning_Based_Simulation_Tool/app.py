from flask import Flask, request, jsonify, send_file
import atexit
import os
import shutil
from utils.meander_migration import return_to_hp, return_short_term_to_hp
from utils.meander_migration_xai import send_map_to_api, generate_shap_heatmap_plot
from utils.meander_migration_visualization import get_feature_importance
from utils.com_cache import m_cache, data_cache, init_cache
from utils.riverbank_erosion import load_resources, prepare_future_input, make_predictions, generate_feature_sensitivity_heatmap
from utils.riverbank_erosion_xai import generate_heatmap_with_timesteps
from utils.FloodLogic import load_model, flood_prediction_logic
from utils.simulation_tool import load_resource_simulation , make_prediction_simulation, prepare_future_input_simulation_year_quarter
from utils.simulation_tool_xai import *
from flask import send_from_directory
from flask_cors import CORS

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

@app.get('/meander_migration/params/short_term/')
def get_raw_point_vals():
    query = request.args.to_dict(flat=False)  # `flat=False` allows list parsing
    years = list(map(int, query.get('year', [])))
    quarters = list(map(int, query.get('quart', [])))

    temp = list(map(float, query.get('temp', [])))
    rain = list(map(float, query.get('rain', [])))
    runoff = list(map(float, query.get('run', [])))
    soil = list(map(float, query.get('soil', [])))
    lv= list(map(float, query.get('lv', [])))
    hv= list(map(float, query.get('hv', [])))


    if not (len(years) == len(quarters) == len(temp) == len(rain) == len(runoff) == len(soil) == len(lv) == len(hv)):
        return jsonify({'error': 'All input lists (year, quart, temp, rain, run, soil) must be the same length'}), 400

    predictions = return_short_term_to_hp(years, quarters, temp, rain, runoff, soil, lv, hv)

    result = pd.DataFrame(predictions, columns=['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist'])
    return jsonify({
        'year': years,
        'quart': quarters,
        'temperature': temp,
        'rainfall': rain,
        'runoff': runoff,
        'soil': soil,
        'lv': lv,
        'hv':hv,
        'predictions': result.to_dict(orient='records')
    })

@app.get('/meander_migration/params/short_term/explain')
def get_shap_plot():
    query = request.args.to_dict()
    y = int(query['year'])
    q = int(query['quart'])
    map_idx = int(query['idx'])

    im_path, error = get_feature_importance(y, q, map_idx)
    if im_path:
        return send_file(im_path, mimetype='image/png')
    else:
        return jsonify({'error': error or 'Failed to generate image'}), 500



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
    
@app.route('/predict_simulation_tool_batch', methods=['POST'])
def predict_simulation_tool_batch():
    try:
        input_data = request.get_json()
        inputs = input_data.get("inputs", [])
        if not inputs:
            return jsonify({"error": "No inputs provided"}), 400

        results = []
        for entry in inputs:
            year = entry.get("year")
            quarter = entry.get("quarter")
            rainfall = entry.get("rainfall")
            temp = entry.get("temp")

            if None in (year, quarter, rainfall, temp):
                return jsonify({"error": f"Missing fields in input: {entry}"}), 400

            df_input = pd.DataFrame([{
                'year': int(year),
                'quarter': int(quarter),
                'rainfall': float(rainfall),
                'temperature': float(temp),
                'date': pd.to_datetime(f'{year}-{int(quarter)*3 - 2}-01')
            }])

            pred_df = make_prediction_simulation(simulation_model, df_input, scaler_features, scaler_targets)
            pred_dict = pred_df.iloc[0].to_dict()
            pred_dict["quarter"] = quarter

            coords = pred_dict.get("centerline_coordinates", [])
            if coords:
                pred_dict["centerline_coordinates"] = [list(c) for c in coords]

            results.append(pred_dict)

        return jsonify({"predictions": results}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/predict_simulation_tool_batch_with_heatmap', methods=['POST'])
def predict_with_heatmap():
    try:
        input_data = request.get_json()
        inputs = input_data.get("inputs", [])
        if not inputs:
            return jsonify({"error": "No inputs provided"}), 400

        feature_names = ['year', 'quarter', 'rainfall', 'temperature']
        target_names = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']

        results = []

        for entry in inputs:
            year = entry.get("year")
            quarter = entry.get("quarter")
            rainfall = entry.get("rainfall")
            temp = entry.get("temp")

            if None in (year, quarter, rainfall, temp):
                return jsonify({"error": f"Missing fields in input: {entry}"}), 400

            # Prepare input DataFrame for that quarter
            df_input = prepare_future_input_simulation_year_quarter(year, quarter, rainfall, temp)
            df_single = df_input[df_input['quarter'] == quarter]

            # Predict
            pred_df = make_prediction_simulation(simulation_model, df_single, scaler_features, scaler_targets)
            pred_dict = pred_df.iloc[0].to_dict()
            pred_dict["quarter"] = quarter

            # Convert tuples to lists for JSON serialization
            coords = pred_dict.get("centerline_coordinates", [])
            if coords:
                pred_dict["centerline_coordinates"] = [list(c) for c in coords]

            # Calculate SHAP feature importance per target
            feature_importance_per_target, heatmap_url = calculate_shap_feature_importance_per_target(
                model=simulation_model,
                data=df_single,
                feature_names=feature_names,
                target_names=target_names
            )

            pred_dict["feature_importance_per_target"] = feature_importance_per_target
            pred_dict["heatmap_url"] = heatmap_url

            results.append(pred_dict)

        return jsonify({"predictions": results}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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