from flask import send_file
import numpy as np
import tensorflow as tf
import os
from utils.com_cache import m_cache
from tensorflow.keras.models import clone_model
import shap

import matplotlib
matplotlib.use('Agg')  
import matplotlib.pyplot as plt
# don't open gui windows bc it interacts with main thread from worker

def intialize_model(model):
    input_data = np.random.rand(1, 4, 6).astype(np.float32)
    _ = model(input_data)
    return model

def generate_map(input_data, model):
    input_data = tf.convert_to_tensor(input_data)
    
    
    with tf.GradientTape(watch_accessed_variables=False) as tape:
        tape.watch(input_data) 
        predictions = model(input_data)  
        loss = tf.reduce_sum(predictions)  


    gradients = tape.gradient(loss, input_data)
    saliency = tf.abs(gradients)  
    saliency_map = saliency.numpy().squeeze() 
    
    return predictions, saliency_map

def generate_map_png(sal_map, idx):
    try:
        IMAGE_FOLDER = r'data_dir/meander_migration_sal_maps'
        if not os.path.exists(IMAGE_FOLDER):
            os.makedirs(IMAGE_FOLDER)
        
        img_filename = f'sal_map_timestep{idx}.png'
        img_path = os.path.join(IMAGE_FOLDER, img_filename)
        
        # Use descriptive labels for the 6 input features (3 PCA components + 3 time features)
        x_labels = [
            'Comp 1\n(Control Points 3, 5, 4, 6, 1)',
            'Comp 2\n(Control Points 2, 1, 5, 6, 4)',
            'Comp 3\n(Control Points 6, 4, 3, 5, 2)',
            'Quarter Sin',
            'Quarter Cos',
            'Year Scaled'
        ]

        plt.figure(figsize=(10, 6))
        plt.imshow(sal_map, cmap='hot', aspect='auto')
        plt.colorbar()
        plt.title(f'Saliency Map for Timestep {idx + 1}', fontsize=14)
        plt.xticks(ticks=np.arange(6), labels=x_labels, rotation=30, ha='right')
        plt.yticks(ticks=np.arange(4), labels=[f'Timestep {i+1}' for i in range(4)])
        plt.xlabel('Features')
        plt.ylabel('Input Timesteps')

        # Optional: Add summary text box with top features per component
        textstr = (
            "Top Contributing Features:\n"
            "Comp 1: CP 3, 5, 4, 6, 1\n"
            "Comp 2: CP 2, 1, 5, 6, 4\n"
            "Comp 3: CP 6, 4, 3, 5, 2"
        )
        plt.gcf().text(0.7, 0.2, textstr, fontsize=9, bbox=dict(facecolor='white', alpha=0.8))

        plt.tight_layout()
        plt.savefig(img_path, dpi=300)
        plt.close()
        # Close the plot to free memory
        
        return img_path
    except Exception as e:
        return None, f'Could not generate saliency map due to: {str(e)}'
         
def clear_images():
    IMAGE_FOLDER=r'data_dir\meander_migration_sal_maps'
    images_list=os.listdir(IMAGE_FOLDER)
    for i in images_list:
        os.remove(os.path.join(IMAGE_FOLDER,i))        

def send_map_to_api(year, quarter, map_idx):
    cache_key = f'{year}_{quarter}'
    cached_data = m_cache.get(cache_key)
    
    if cached_data:
        _, maps = cached_data
        img_path = generate_map_png(maps[map_idx], map_idx)
        
        if img_path:
            return send_file(img_path, mimetype='image/png')
        else:
            return 'Failed to generate image', 500
    else:
        return 'Predict first to generate saliency map', 404

def compute_shap_values(model, input_df):
    shap_values_dict = {}

    # Each estimator corresponds to one output dimension
    num_outputs = len(model.estimators_)

    for output_idx in range(num_outputs):
        estimator = model.estimators_[output_idx]
        explainer = shap.Explainer(estimator, input_df)
        shap_values = explainer(input_df)

        for row_idx in range(len(input_df)):
            if row_idx not in shap_values_dict:
                shap_values_dict[row_idx] = {}

            shap_values_dict[row_idx][f'output_{output_idx}'] = {
                'shap_values': shap_values.values[row_idx].tolist(),
                'base_value': shap_values.base_values[row_idx],
                'feature_values': input_df.iloc[row_idx].to_dict(),
                'feature_names': input_df.columns.tolist()
            }

    return shap_values_dict


def generate_shap_heatmap_plot(y, q, map_idx):
    try:
        IMAGE_FOLDER = r'data_dir/meander_migration_shap_plots'
        if not os.path.exists(IMAGE_FOLDER):
            os.makedirs(IMAGE_FOLDER)

        row_index = 0  
        img_filename = f'shap_heatmap_row{row_index}.png'
        img_path = os.path.join(IMAGE_FOLDER, img_filename)

        shap_cache_key = f'shap_{y}_{q}'  
        shap_data = m_cache.get(shap_cache_key)
        if shap_data is None:
            return None, f"SHAP cache not found for key '{shap_cache_key}'"

        if row_index not in shap_data:
            return None, f"No SHAP data found for row {row_index}"

        # Collect SHAP values across all outputs
        outputs = sorted(shap_data[row_index].keys(), key=lambda x: int(x.split('_')[1]))
        num_outputs = len(outputs)

        feature_labels = ['Year Scaled', 'Quarter Sin', 'Quarter Cos', 'Rainfall', 'Temperature', 'Soil Water Volume', 'Surface Runoff']
        num_features = len(feature_labels)

        heatmap = np.zeros((num_outputs, num_features))
        for i, output_key in enumerate(outputs):
            shap_values = np.array(shap_data[row_index][output_key]['shap_values'])
            heatmap[i, :] = shap_values

        # Plot heatmap
        plt.figure(figsize=(10, 5))
        im = plt.imshow(heatmap, cmap='coolwarm', aspect='auto')
        plt.colorbar(im, label='SHAP Value')
        plt.xticks(ticks=np.arange(num_features), labels=feature_labels, rotation=30, ha='right')
        plt.yticks(ticks=np.arange(num_outputs), labels=[f'Output {i+1}' for i in range(num_outputs)])
        plt.title(f'SHAP Heatmap for Row {row_index}', fontsize=14)
        plt.xlabel('Features')
        plt.ylabel('Model Outputs')

        plt.tight_layout()
        plt.savefig(img_path, dpi=300)
        plt.close()

        return img_path, None  # Still a tuple
    except Exception as e:
        return None, str(e)
