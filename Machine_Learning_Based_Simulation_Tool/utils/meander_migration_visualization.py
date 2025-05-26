import numpy as np
from utils.com_cache import data_cache

latitudes=r'data_dir\y_coords_7.5m.npy'
longitudes=r'data_dir\x_coords_7.5m.npy'
latitudes=np.load(latitudes)
longitudes=np.load(longitudes)

x1, y1 = 497, 305
x2, y2 = 513, 298


m = (y2 - y1) / (x2 - x1)
c = y1 - m * x1


def get_perpendicular_point(known_coord, d_shift):
  shifted_coord=d_shift+known_coord
  return shifted_coord

def get_coordinates(x_pix, y_pix):
  lat=latitudes[x_pix, y_pix]
  long=longitudes[x_pix, y_pix]

  return (lat,long)
  
def get_raw_predictions(year, quarter):
  cache_key=f'{year}_{quarter}'
  raw_df=data_cache.get(cache_key)
  control_points_std=[[248, 309], [236, 309], [409, 330], [409, 344], [533, 374], [548, 383], [497, 305], [513, 298]]
  if raw_df is not None:
    dist_cols = raw_df.select_dtypes(include=['number'])
    latest_infer = dist_cols.iloc[-1].to_dict()

    new_centerline_points={}
    centerline_coordinates=[]

    index_mapping = {
    0: lambda l: [get_perpendicular_point(control_points_std[0][1], l), control_points_std[0][1]],
    1: lambda l: [get_perpendicular_point(control_points_std[1][1], l), control_points_std[1][1]],
    2: lambda l: [control_points_std[2][0], get_perpendicular_point(control_points_std[2][0], l)],
    3: lambda l: [control_points_std[3][0], get_perpendicular_point(control_points_std[3][0], l)]
    }

    for i, l in enumerate(latest_infer.values()):  
      if i in index_mapping: 
          new_centerline_points[i] = index_mapping[i](l)

      if i==4:
        x_m_1=control_points_std[6][0] + np.sqrt(np.square(l)/np.square((1+np.square(m))))
        x_m_2=control_points_std[6][0] - np.sqrt(np.square(l)/np.square((1+np.square(m))))
        xm=0
        if x_m_1<x_m_2:
          xm=np.abs(x_m_1)
        else:
          xm=np.abs(x_m_2)

        y_m_1=control_points_std[6][1] + ((l*m)/np.sqrt(np.square(m)+1))
        y_m_2=control_points_std[6][1] + ((l*m)/np.sqrt(np.square(m)+1))
        ym=0
        if y_m_1<y_m_2:
          xm=np.abs(y_m_1)
        else:
          xm=np.abs(y_m_2)

        new_centerline_points[i]=[xm,ym]

      if i == 5:
        x_m_1=control_points_std[7][0] + np.sqrt(np.square(l)/np.square((1+np.square(m))))
        x_m_2=control_points_std[7][0] - np.sqrt(np.square(l)/np.square((1+np.square(m))))
        xm=0
        if x_m_1<x_m_2:
          xm=np.abs(x_m_1)
        else:
          xm=np.abs(x_m_2)

        y_m_1=control_points_std[7][1] + ((l*m)/np.sqrt(np.square(m)+1))
        y_m_2=control_points_std[7][1] + ((l*m)/np.sqrt(np.square(m)+1))
        ym=0
        if y_m_1<y_m_2:
          xm=np.abs(y_m_1)
        else:
          xm=np.abs(y_m_2)
      
    for i in new_centerline_points.values():
      centerline_coordinates.append(get_coordinates(int(i[0]), int(i[1])))

    
    return centerline_coordinates
  else:
    return 'predict first to get point values'

import os
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime

def get_feature_importance(y, q, map_idx):
    IMAGE_FOLDER = 'data_dir/meander_migration_shap_plots'
    if not os.path.exists(IMAGE_FOLDER):
        os.makedirs(IMAGE_FOLDER)

    # Simulate some SHAP values
    np.random.seed(map_idx + y + q)  # Seed for reproducibility
    num_outputs = 6
    feature_labels = ['Year Scaled', 'Quarter Sin', 'Quarter Cos', 'Rainfall', 'Temperature',
                      'Soil Water Volume', 'Surface Runoff']
    num_features = len(feature_labels)

    # Simulate SHAP-like values (positive and negative)
    heatmap = np.random.randn(num_outputs, num_features) * 0.3  # Mean 0, std dev 0.3

    # Optional: amplify feature importance for some outputs
    heatmap[:, [3, 4, 6]] += np.random.rand(num_outputs, 1) * 0.5  # Boost Rainfall, Temp, Runoff

    # Plot and save image
    img_filename = f'simulated_shap_row{map_idx}.png'
    img_path = os.path.join(IMAGE_FOLDER, img_filename)

    plt.figure(figsize=(10, 5))
    im = plt.imshow(heatmap, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)
    plt.colorbar(im, label='Simulated SHAP Value')
    plt.xticks(ticks=np.arange(num_features), labels=feature_labels, rotation=30, ha='right')
    plt.yticks(ticks=np.arange(num_outputs), labels=[f'Output {i+1}' for i in range(num_outputs)])
    plt.title(f'SHAP Heatmap for Row {map_idx} ({y} Q{q})', fontsize=14)
    plt.xlabel('Features')
    plt.ylabel('Model Outputs : c*_dist')

    plt.tight_layout()
    plt.savefig(img_path, dpi=300)
    plt.close()

    return img_path, None
