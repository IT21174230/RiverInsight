import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import os

def intialize_model(model):
    input_data = np.random.rand(1, 4, 6).astype(np.float32)
    _ = model(input_data)
    return model

def generate_map(input_data, model):
    input_data = tf.convert_to_tensor(input_data)
    
    with tf.GradientTape() as tape:
        tape.watch(input_data) 
        predictions = model(input_data)  
        loss = predictions  

    gradients = tape.gradient(loss, input_data)
    saliency = tf.abs(gradients)  
    saliency_map = saliency.numpy().squeeze() 
    
    return predictions, saliency_map

def generate_map_png(map,idx,image_filename='saliency_map_timestep_2.png'):
    try:
        IMAGE_FOLDER=r'data_dir\meander_migration_sal_maps'
        img_filename = image_filename
        
        # Save the saliency map as PNG
        plt.imshow(map, cmap='hot', aspect='auto')
        plt.colorbar()
        plt.title(f'Saliency Map for Timestep {idx + 1}')
        plt.xticks(ticks=np.arange(6), labels=[f'Feat {i+1}' for i in range(6)])
        plt.yticks(ticks=np.arange(4), labels=[f'Timestep {i+1}' for i in range(4)])
        plt.xlabel('Features')
        plt.ylabel('Timesteps')
        
        # Save the figure in the static/images directory
        plt.savefig(os.path.join(IMAGE_FOLDER, img_filename), dpi=300)
        plt.close()  # Close the plot to free memory
        return 'succesfully generate saliency map'
    except Exception as e:
        return 'could not generate saliency map due to '+e   
     
def clear_images():
    pass