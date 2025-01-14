import pandas as pd
import numpy as np
import joblib
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
from utils.meander_migration_xai import intialize_model, generate_map, generate_map_png
# to prevent the error when flattening the predictions
import tensorflow.python.ops.numpy_ops.np_config as np_config
np_config.enable_numpy_behavior()

model=r'model\0_85_0_59_filt3_6feat.joblib'
scaler_year=r'data_dir\scaler_year.pkl'
scaler_ts=r'data_dir\scaler_ts.pkl'
last_known_input=r'data_dir\last_known_input.pkl'
pca=r'data_dir\pca_obj.pkl'

model=joblib.load(model)
scaler_year=joblib.load(scaler_year)
scaler_ts=joblib.load(scaler_ts)
last_known_input=joblib.load(last_known_input)
pca=joblib.load(pca)

model.training=False

def get_new_time(year, quarter):
  no_of_years=year-2024
  no_of_q=((no_of_years-1)*4)+quarter

  years=[]
  quarters=[]

  if no_of_years==1:
    for i in range(no_of_q):
      quarters.append(i+1)
      years.append(2025)
  else:
     for i in range(no_of_years-1):
      quarters.extend([1,2,3,4])
      for j in range(4):
        years.append(2024+i+1)

      latest=years[-1]

      for i in range(quarter):
        quarters.append(i+1)
        years.append(latest+1)

  return years, quarters, len(quarters)

def add_time_features(df, scaler):
    # Cyclical encoding for quarter
    df['quarter_sin'] = np.sin(2 * np.pi * df['quarter'] / 4)
    df['quarter_cos'] = np.cos(2 * np.pi * df['quarter'] / 4)

    df['year_scaled'] = scaler.transform(df[['year']])  

    return df


def predict_meandering(model, last_known_input, n_steps, pca, years, quarters, scaler_year ):
    
    # from app import task_queue

    predictions = []
    maps=[]
    current_input = last_known_input
    time_df=pd.DataFrame({'year': years, 'quarter': quarters})
    time_df=add_time_features(time_df, scaler_year)
    time_features = time_df[['quarter_sin', 'quarter_cos', 'year_scaled']].values
    
    model=intialize_model(model=model)

    for _ in range(n_steps):
        # Make prediction for the next step
        if _ ==0:
          # pred = model.predict(np.expand_dims(current_input, axis=0))  # Shape (1, input_steps, num_input_features)
          pred, map=generate_map(np.expand_dims(current_input, axis=0), model)
          maps.append(map)
          predictions.append(tf.reshape(pred, [-1]))
          
        elif _==1:
          redundant_pred=predictions[-1]
          pca_feat=pca.transform(redundant_pred.reshape(1, -1))
          time=time_features[0]
          time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time_reshaped], axis=1)
          last_known=last_known_input[-3:]
          final_array = np.vstack([last_known, concatenated])
          pred, map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          # task_queue.put(generate_map_png, map, _)
          generate_map_png(map, _)

        elif _==2:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:2]
          # time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-2:]
          final_array = np.vstack([last_known, concatenated])
          pred, map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          generate_map_png(map, _)


        elif _==3:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:3]
          # time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-1:]
          final_array = np.vstack([last_known, concatenated])
          pred, map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          generate_map_png(map, _)

        else:
          redundant_pred=predictions[-4:]
          pca_feat=pca.transform(redundant_pred)
          time=time_features[(_-3):_+1, :]
          concatenated = np.concatenate([pca_feat, time], axis=1)
          pred, map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          generate_map_png(map, _)

    return np.array(predictions)
  
# years, quarters, n_steps=get_new_time(2026, 1)
# # pass these as parameters to test w postman


def return_to_hp(year, quarter):
  try:
    years, quarters, n_steps=get_new_time(year, quarter)
    predictions= predict_meandering(model, last_known_input, n_steps, pca, years, quarters, scaler_year)
    unscaled_predictions=scaler_ts.inverse_transform(predictions)
    predictions_df=pd.DataFrame({'year': years, 'quarter': quarters})
    targets = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist','c7_dist','c8_dist']
    for i, col in enumerate(targets):
      predictions_df[col] = unscaled_predictions[:, i]
    return predictions_df
  except Exception as e:
    return f'no predictions generated due to \n{e}'

