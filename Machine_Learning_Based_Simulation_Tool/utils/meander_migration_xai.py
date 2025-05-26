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


