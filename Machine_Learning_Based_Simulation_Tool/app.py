from flask import Flask, request, jsonify
import atexit
import os
import shutil
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import send_map_to_api
from utils.com_cache import m_cache, data_cache, init_cache
from utils.riverbank_erosion import load_resources, prepare_future_input, make_predictions, generate_feature_sensitivity_heatmap
from utils.riverbank_erosion_xai import generate_heatmap_with_timesteps
from flask_cors import CORS

# Flask constructor takes the name of current module (__name__) as argument.
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)
init_cache(app)

# Load resources (model and scalers) globally for riverbank erosion
model, scaler_ts, scaler_year = load_resources()

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
        rainfall     = float(data["rainfall"])
        temperature  = float(data["temperature"])
        points       = list(map(int, data.get("points", [])))

        if not points:
            return jsonify({"error": "points must be a non-empty list"}), 400

        # optional delta overrides
        delta_year    = float(data.get("delta_year",    1))
        delta_quarter = int  (data.get("delta_quarter", 1))
        delta_rain    = float(data.get("delta_rain",    0.05))
        delta_temp    = float(data.get("delta_temp",    1.0))

        b64_png = generate_feature_sensitivity_heatmap(
            year, quarter,
            points=points,
            rainfall=rainfall,
            temperature=temperature,
            delta_year=delta_year,
            delta_quarter=delta_quarter,
            delta_rain=delta_rain,
            delta_temp=delta_temp,
        )

        return jsonify({
            "year"       : year,
            "quarter"    : quarter,
            "rainfall"   : rainfall,
            "temperature": temperature,
            "points"     : points,
            "heatmap_png_base64": b64_png
        }), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


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



# Start the Flask app (unchanged)
if __name__ == '__main__':
    app.run(debug=True)