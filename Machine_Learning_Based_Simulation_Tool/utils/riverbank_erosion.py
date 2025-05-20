
from pathlib import Path
import io, base64
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import joblib
from tensorflow.keras.models import load_model

# ────────────────────────────────────────────────────────────────────
# 1.  Paths & globals
# ────────────────────────────────────────────────────────────────────

MODEL_PATH = r'model\riverwidth_nn.h5'
BUNDLE_PATH = r'data_dir\preprocessors.pkl'

TARGETS = [f"Point_{i}" for i in range(1, 26)]  # 25 outputs


def _force_scaler(obj, name=""):
    """
    Make sure we always return a fully-fledged StandardScaler.
    Accepts:
      • a StandardScaler         → returned unchanged
      • [mean_, scale_] list/tuple → converted to StandardScaler
    """
    if hasattr(obj, "transform"):
        return obj                      # already a scaler

    if isinstance(obj, (list, tuple)) and len(obj) == 2:
        mean_, scale_ = map(np.asarray, obj)
        sc = StandardScaler()
        sc.mean_, sc.scale_ = mean_, scale_
        sc.var_ = sc.scale_**2
        sc.n_samples_seen_ = mean_.shape[0] if mean_.shape else 1
        return sc

    raise TypeError(f"{name} inside preprocessors.pkl is not a scaler "
                    f"(got type={type(obj)})")

# ── load everything ──────────────────────────────────────────────
def load_resources():
    model  = load_model(MODEL_PATH, compile=False)
    bundle = joblib.load(BUNDLE_PATH)

    # If your pickle is a dict (recommended)
    if isinstance(bundle, dict):
        scaler_y   = _force_scaler(bundle["scaler_y"],   "scaler_y")
        scaler_year= _force_scaler(bundle["scaler_year"],"scaler_year")
        scaler_rain= _force_scaler(bundle["scaler_rain"],"scaler_rain")
        scaler_temp= _force_scaler(bundle["scaler_temp"],"scaler_temp")
        feature_cols = bundle["feature_cols"]

    # If it is a plain list / tuple
    elif isinstance(bundle, (list, tuple)) and len(bundle) >= 5:
        scaler_y    = _force_scaler(bundle[0], "scaler_y")
        scaler_year = _force_scaler(bundle[1], "scaler_year")
        scaler_rain = _force_scaler(bundle[2], "scaler_rain")
        scaler_temp = _force_scaler(bundle[3], "scaler_temp")
        feature_cols = bundle[4]

    else:
        raise ValueError("preprocessors.pkl has unexpected structure. "
                         "Expected dict with keys or list of length≥5.")

    scalers = dict(y=scaler_y, year=scaler_year,
                   rain=scaler_rain, temp=scaler_temp)

    return model, scalers, feature_cols

MODEL, SCALERS, FEATURE_COLS = load_resources()   # load once at import


# ────────────────────────────────────────────────────────────────────
# 3.  Feature builder
# ────────────────────────────────────────────────────────────────────
def prepare_future_input(year, quarter, rainfall, temperature):
    """Return a (1, n_features) NumPy array ready for MODEL.predict()."""
    df = pd.DataFrame({
        "year"       : [year],
        "quarter"    : [quarter],
        "rainfall"   : [rainfall],
        "temperature": [temperature]
    })

    # Cyclical quarter encoding
    df["quarter_sin"] = np.sin(2*np.pi*df["quarter"]/4)
    df["quarter_cos"] = np.cos(2*np.pi*df["quarter"]/4)

    # Scaled & amplified year
    df["year_scaled"]           = SCALERS["year"].transform(df[["year"]])
    df["year_scaled_amplified"] = df["year_scaled"] * 10
    df["year_quarter_interaction"] = (
        df["year_scaled_amplified"] * (df["quarter_sin"] + df["quarter_cos"])
    )

    # Scaled meteo features
    df["rainfall_scaled"]    = SCALERS["rain"].transform(df[["rainfall"]])
    df["temperature_scaled"] = SCALERS["temp"].transform(df[["temperature"]])

    return df[FEATURE_COLS].values


# ────────────────────────────────────────────────────────────────────
# 4.  Prediction wrapper
# ────────────────────────────────────────────────────────────────────
def make_predictions(feature_vec):
    """
    Parameters
    ----------
    feature_vec : np.ndarray shape (1, n_features)

    Returns
    -------
    dict  {Point_1: value, … Point_25: value}
    """
    y_norm = MODEL.predict(feature_vec)
    y_orig = SCALERS["y"].inverse_transform(y_norm)[0]   # (25,)
    return dict(zip(TARGETS, map(float, y_orig)))


# ------------------------------------------------------------------
# NEW  generate_feature_sensitivity_heatmap
#        x-axis = raw features (year, quarter, rainfall, temperature)
#        y-axis = selected points                 (Point_1 … Point_25)
#        cell   = Δ-width when that feature nudged upward
# ------------------------------------------------------------------
def generate_feature_sensitivity_heatmap(
    year: int,
    quarter: int,
    points: list[int],
    *,
    rainfall: float,
    temperature: float,
    delta_year: int = 1,
    delta_quarter: int = 1,
    delta_rain: float = 0.05,
    delta_temp: float = 1.0,
):
    """
    Returns a base-64 PNG that shows, for each chosen point,
    how much the predicted width changes when *one* raw feature
    is nudged upward by the supplied deltas.
    """
    # -------- 1. base prediction --------------------------------------------
    base = make_predictions(
        prepare_future_input(year, quarter, rainfall, temperature)
    )
    base = np.array([base[f"Point_{p}"] for p in points])  # (len(points),)

    # -------- 2. predictions with each feature nudged -----------------------
    year_up = make_predictions(
        prepare_future_input(year + delta_year, quarter, rainfall, temperature)
    )
    quarter_up = make_predictions(
        prepare_future_input(year,
                             ((quarter - 1 + delta_quarter) % 4) + 1,
                             rainfall, temperature)
    )
    rain_up = make_predictions(
        prepare_future_input(year, quarter, rainfall + delta_rain, temperature)
    )
    temp_up = make_predictions(
        prepare_future_input(year, quarter, rainfall, temperature + delta_temp)
    )

    # keep only selected points, shape (len(points),)
    year_up    = np.array([year_up[f"Point_{p}"]    for p in points])
    quarter_up = np.array([quarter_up[f"Point_{p}"] for p in points])
    rain_up    = np.array([rain_up[f"Point_{p}"]    for p in points])
    temp_up    = np.array([temp_up[f"Point_{p}"]    for p in points])

    # -------- 3. build heat-map DataFrame ------------------------------------
    diffs = np.vstack([
        year_up    - base,
        quarter_up - base,
        rain_up    - base,
        temp_up    - base
    ]).T   # (points, 4)

    df = pd.DataFrame(
        diffs,
        index=[f"Point_{p}" for p in points],
        columns=["year", "quarter", "rainfall", "temperature"]
    )

    # -------- 4. draw heat-map ----------------------------------------------
    import matplotlib.pyplot as plt, seaborn as sns, io, base64
    fig, ax = plt.subplots(figsize=(6, 0.45*len(points)+1.5))
    sns.heatmap(
        df, ax=ax, cmap="coolwarm", center=0, linewidths=.5,
        cbar_kws=dict(label="Δ width (m) when feature ↑")
    )
    ax.set_title(f"Sensitivity at {year}-Q{quarter}")
    ax.set_xlabel("Feature nudged upward"); ax.set_ylabel("River point")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
