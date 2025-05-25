import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import tensorflow as tf
import joblib  # For loading scalers
import io
import base64

# Load resources (model and scaler)
custom_objects = {
    "mse": tf.keras.losses.MeanSquaredError()
}

model = tf.keras.models.load_model(r"model\erosion_neural_network_model.h5", custom_objects=custom_objects)
scaler_year = joblib.load(r"data_dir\scaler_year.pkl")

def generate_heatmap_with_timesteps(model, start_year, start_quarter, scaler_year, points, timesteps=5):
    """
    Generate a heatmap of predictions over the previous timesteps for specified river points.

    Args:
        model: Trained neural network model.
        start_year: Starting year for the heatmap (e.g., 2025).
        start_quarter: Starting quarter for the heatmap (e.g., Q1=1, Q2=2, etc.).
        scaler_year: Scaler used for the 'year' feature during training.
        points: List of river points to include in the heatmap (e.g., [1, 2, 3]).
        timesteps: Number of timesteps to look back (default=5).

    Returns:
        heatmap_image: A base64 string representation of the heatmap image.
    """
    # Create a DataFrame for the timesteps
    data = []
    for t in range(timesteps):
        # Compute the year and quarter for each timestep
        quarter = start_quarter - t
        year = start_year
        if quarter <= 0:
            year -= 1
            quarter += 4
        data.append({"year": year, "quarter": quarter})

    # Convert to DataFrame
    timestep_df = pd.DataFrame(data)

    # Apply feature transformations
    timestep_df["quarter_sin"] = np.sin(2 * np.pi * timestep_df["quarter"] / 4)
    timestep_df["quarter_cos"] = np.cos(2 * np.pi * timestep_df["quarter"] / 4)
    timestep_df["year_scaled_amplified"] = scaler_year.transform(timestep_df[["year"]]) * 10
    timestep_df["year_quarter_interaction"] = (
        timestep_df["year_scaled_amplified"] * (timestep_df["quarter_sin"] + timestep_df["quarter_cos"])
    )

    # Select features for the model
    feature_cols = ["year_scaled_amplified", "quarter_sin", "quarter_cos", "year_quarter_interaction"]
    features = timestep_df[feature_cols]

    # Predict for all timesteps
    predictions = model.predict(features)

    # Extract predictions for the specified points
    heatmap_data = pd.DataFrame(predictions[:, [p - 1 for p in points]], columns=[f"Point_{p}" for p in points])
    heatmap_data["Timestep"] = [f"{int(row.year)}-Q{int(row.quarter)}" for _, row in timestep_df.iterrows()]

    # Set the timestep as the index for heatmap plotting
    heatmap_data.set_index("Timestep", inplace=True)

    # Plot the heatmap
    plt.figure(figsize=(8, 6))
    sns.heatmap(heatmap_data.T, annot=False, cmap="YlGnBu", cbar_kws={'label': ''})
    plt.title(f"Predictions for Last {len(heatmap_data)} Timesteps")
    plt.ylabel("River Points")
    plt.xlabel("Time (Year-Quarter)")
    plt.xticks(rotation=45)

    # Save the plot to a bytes buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format="png")
    plt.close()
    buffer.seek(0)

    # Encode the image to base64
    heatmap_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
    buffer.close()

    return heatmap_image
