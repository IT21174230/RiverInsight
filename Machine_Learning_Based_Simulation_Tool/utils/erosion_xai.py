import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import tensorflow as tf
import joblib
import io, base64

# ─── Load model and scalers ──────────────────────────────────────────
custom_objects = {"mse": tf.keras.losses.MeanSquaredError()}
model         = tf.keras.models.load_model(r"model\erosion_neural_network_model.h5",
                                           custom_objects=custom_objects)

scaler_year   = joblib.load(r"data_dir\scaler_year.pkl")
scaler_rain   = joblib.load(r"data_dir\scaler_rainfall.pkl")      # NEW
scaler_temp   = joblib.load(r"data_dir\scaler_temperature.pkl")   # NEW


def generate_heatmap_with_timesteps(
        model,
        start_year: int,
        start_quarter: int,
        scaler_year,
        scaler_rain,
        scaler_temp,
        points: list,
        rainfall_series: list,
        temperature_series: list,
        timesteps: int = 5
    ) -> str:
    """
    Create a heat-map of predictions over the previous `timesteps`, now
    including rainfall & temperature as inputs.

    • `rainfall_series`  and `temperature_series` must each contain
      *exactly* `timesteps` values, ordered from the most-recent period
      (start_year/start_quarter) backwards in time.
    • Returns: PNG image encoded as base64 for easy embedding.
    """
    if len(rainfall_series) != timesteps or len(temperature_series) != timesteps:
        raise ValueError("Lengths of rainfall_series and temperature_series "
                         "must match `timesteps`.")

    # ── Build the timeline (most-recent → oldest) ─────────────────────
    data = []
    for t in range(timesteps):
        q = start_quarter - t
        y = start_year
        if q <= 0:
            y -= 1
            q += 4
        data.append({"year": y, "quarter": q})

    timestep_df = pd.DataFrame(data)

    # ── Raw meteorology values (already aligned newest→oldest) ────────
    timestep_df["rainfall_raw"]    = rainfall_series
    timestep_df["temperature_raw"] = temperature_series

    # ── Cyclical & interaction features ───────────────────────────────
    timestep_df["quarter_sin"] = np.sin(2 * np.pi * timestep_df["quarter"] / 4)
    timestep_df["quarter_cos"] = np.cos(2 * np.pi * timestep_df["quarter"] / 4)
    timestep_df["year_scaled_amplified"] = scaler_year.transform(
        timestep_df[["year"]]
    ) * 10  # amplify like in training
    timestep_df["year_quarter_interaction"] = (
        timestep_df["year_scaled_amplified"] *
        (timestep_df["quarter_sin"] + timestep_df["quarter_cos"])
    )

    # ── Scale rainfall & temperature the same way you did in training ─
    timestep_df["rainfall_scaled"]    = scaler_rain.transform(
        timestep_df[["rainfall_raw"]])
    timestep_df["temperature_scaled"] = scaler_temp.transform(
        timestep_df[["temperature_raw"]])

    feature_cols = [
        "year_scaled_amplified", "quarter_sin", "quarter_cos",
        "year_quarter_interaction", "rainfall_scaled", "temperature_scaled"
    ]
    features = timestep_df[feature_cols]

    # ── Make predictions ──────────────────────────────────────────────
    preds = model.predict(features, verbose=0)

    heatmap_df = pd.DataFrame(
        preds[:, [p - 1 for p in points]],
        columns=[f"Point_{p}" for p in points]
    )
    heatmap_df["Timestep"] = [
        f"{int(r.year)}-Q{int(r.quarter)}" for r in timestep_df.itertuples()
    ]
    heatmap_df.set_index("Timestep", inplace=True)

    # ── Plot heat-map ─────────────────────────────────────────────────
    plt.figure(figsize=(8, 6))
    sns.heatmap(heatmap_df.T, cmap="YlGnBu", cbar_kws={"label": ""})
    plt.title(f"Predictions for Last {timesteps} Timesteps")
    plt.ylabel("River Points")
    plt.xlabel("Time (Year-Quarter)")
    plt.xticks(rotation=45)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close()
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
