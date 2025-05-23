import pandas as pd
import pickle as pkl
from flask import Flask, request, jsonify
from werkzeug.exceptions import HTTPException
import os
import base64
from datetime import datetime
import shap
import lime
import lime.lime_tabular
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO


def calculate_shap_feature_importance(model, data, feature_names):
    """
    Calculate SHAP values and compute feature importance percentages.
    """
    # Extract the underlying XGBRegressor from the MultiOutputRegressor
    underlying_model = model.estimators_[0]  # Assuming the first estimator is XGBRegressor
    
    # Create a SHAP TreeExplainer
    explainer = shap.TreeExplainer(underlying_model)
    
    # Calculate SHAP values
    shap_values = explainer.shap_values(data[feature_names])
    
    # Compute the mean absolute SHAP values for each feature
    mean_abs_shap_values = np.mean(np.abs(shap_values), axis=0)
    
    # Calculate the percentage importance of each feature
    total_importance = np.sum(mean_abs_shap_values)
    feature_importance_percentages = (mean_abs_shap_values / total_importance) * 100
    
    # Convert to Python float and create a dictionary
    feature_importance_dict = {
        feature: float(round(percentage, 2)) for feature, percentage in zip(feature_names, feature_importance_percentages)
    }
    
    return feature_importance_dict


def calculate_shap_feature_importance_per_target(model, data, feature_names, target_names):
    """
    Calculate SHAP-based feature importance for each target variable individually and generate a heatmap.
    Returns a base64-encoded image URL for the heatmap.
    
    Parameters:
        model: The trained model (e.g., MultiOutputRegressor).
        data: The input data (pandas DataFrame).
        feature_names: List of feature names.
        target_names: List of target variable names.
    
    Returns:
        A dictionary where keys are target names and values are dictionaries of feature importance percentages,
        and a base64-encoded image URL for the heatmap.
    """
    # Initialize a dictionary to store feature importance for each target
    feature_importance_per_target = {}

    # Initialize a matrix to store feature importance values for the heatmap
    heatmap_data = np.zeros((len(target_names), len(feature_names)))

    # Iterate over each target variable
    for i, target_name in enumerate(target_names):
        # Extract the underlying model for the current target
        underlying_model = model.estimators_[i]  # Assuming MultiOutputRegressor
        
        # Create a SHAP TreeExplainer for the current target's model
        explainer = shap.TreeExplainer(underlying_model)
        
        # Calculate SHAP values for the current target
        shap_values = explainer.shap_values(data[feature_names])
        
        # Compute the mean absolute SHAP values for each feature
        mean_abs_shap_values = np.mean(np.abs(shap_values), axis=0)
        
        # Calculate the percentage importance of each feature
        total_importance = np.sum(mean_abs_shap_values)
        feature_importance_percentages = (mean_abs_shap_values / total_importance) * 100
        
        # Convert to Python float and create a dictionary
        feature_importance_dict = {
            feature: float(round(percentage, 2)) for feature, percentage in zip(feature_names, feature_importance_percentages)
        }
        
        # Store the feature importance dictionary for the current target
        feature_importance_per_target[target_name] = feature_importance_dict
        
        # Store the feature importance percentages in the heatmap data matrix
        heatmap_data[i, :] = feature_importance_percentages

    # Generate the heatmap without annotations
    plt.figure(figsize=(10, 8))
    sns.heatmap(heatmap_data, annot=False, cmap="YlGnBu", 
                xticklabels=feature_names, yticklabels=target_names)
    plt.xlabel("Features")
    plt.ylabel("Targets")

    # Save the heatmap to a BytesIO object
    buffer = BytesIO()
    plt.savefig(buffer, format="png")
    plt.close()
    buffer.seek(0)

    # Encode the image as a base64 string
    heatmap_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    buffer.close()

    # Create a data URL for the image
    heatmap_url = f"data:image/png;base64,{heatmap_base64}"

    return feature_importance_per_target, heatmap_url