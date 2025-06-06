import pandas as pd
import numpy as np
import joblib
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
from utils.meander_migration_xai import intialize_model, generate_map
from utils.com_cache import m_cache, data_cache
# to prevent the error when flattening the predictions
import tensorflow.python.ops.numpy_ops.np_config as np_config
np_config.enable_numpy_behavior()

model=r'model\0_85_0_59_filt3_6feat.joblib'
scaler_year=r'data_dir\scaler_year.pkl'
scaler_ts=r'data_dir\scaler_ts.pkl'
last_known_input=r'data_dir\last_known_input.pkl'
pca=r'data_dir\pca_obj.pkl'
past_migration_vals=r'data_dir\MeanderingInterploatedUpdated.csv'
latitudes=r'data_dir\y_coords_7.5m.npy'
longitudes=r'data_dir\x_coords_7.5m.npy'

model=joblib.load(model)
scaler_year=joblib.load(scaler_year)
scaler_ts=joblib.load(scaler_ts)
last_known_input=joblib.load(last_known_input)
pca=joblib.load(pca)
past_vals=pd.read_csv(past_migration_vals, index_col=0)
latitudes=np.load(latitudes)
longitudes=np.load(longitudes)

inti_values=init_values = past_vals.iloc[0]

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

        if _ ==0:
          pred, sal_map=generate_map(np.expand_dims(current_input, axis=0), model)
          maps.append(sal_map)
          predictions.append(tf.reshape(pred, [-1]))
          
        elif _==1:
          redundant_pred=predictions[-1]
          pca_feat=pca.transform(redundant_pred.reshape(1, -1))
          time=time_features[0]
          time_reshaped = time.reshape(1, -1)  

          concatenated = np.concatenate([pca_feat, time_reshaped], axis=1)
          last_known=last_known_input[-3:]
          final_array = np.vstack([last_known, concatenated])
          pred, sal_map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(sal_map)
          predictions.append(tf.reshape(pred, shape=[-1]))

        elif _==2:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:2]
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-2:]
          final_array = np.vstack([last_known, concatenated])
          pred, sal_map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(sal_map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          
        elif _==3:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:3]
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-1:]
          final_array = np.vstack([last_known, concatenated])
          pred, sal_map=generate_map(np.expand_dims(final_array, axis=0), model)
          maps.append(sal_map)
          predictions.append(tf.reshape(pred, shape=[-1]))

        else:
          redundant_pred=predictions[-4:]
          pca_feat=pca.transform(redundant_pred)
          time=time_features[(_-3):_+1, :]
          concatenated = np.concatenate([pca_feat, time], axis=1)
          pred, sal_map=generate_map(np.expand_dims(concatenated, axis=0), model)
          maps.append(sal_map)
          predictions.append(tf.reshape(pred, shape=[-1]))
          
    return np.array(predictions), maps

def get_past_meandering_values(df, target_year, target_quarter):
  df['year'] = df['name'].apply(lambda x: int(x.split('-')[0]))
  df['quarter'] = df['name'].apply(lambda x: int(x.split('-')[1]))

  columns_to_drop = ['name', 'c5_dist', 'c6_dist']
  df.drop(columns=[col for col in columns_to_drop if col in df.columns], inplace=True)
  filtered_df = df[(df["year"] < target_year) | ((df["year"] == target_year) & (df["quarter"] <= target_quarter))]
  if not filtered_df.empty:
      numeric_cols = filtered_df.columns.difference(["year", "quarter"])
      filtered_df[numeric_cols] = ((filtered_df[numeric_cols] - filtered_df.iloc[0][numeric_cols]) * 0.625).astype(float).round(4)
      filtered_df['bend_1'] = np.abs((filtered_df['c1_dist'] - filtered_df['c2_dist']).astype(float).round(4))
      filtered_df['bend_2'] = np.abs((filtered_df['c3_dist'] - filtered_df['c4_dist']).astype(float).round(4))
      filtered_df['bend_3'] = np.abs((filtered_df['c7_dist'] - filtered_df['c8_dist']).astype(float).round(4))
  return filtered_df

def return_to_hp(year, quarter):
  if year>2024:
    try:
      cache_key=f'{year}_{quarter}'
      
      cached_data=m_cache.get(cache_key)
      
      if cached_data is not None:
        predictions, maps=cached_data
        years, quarters, n_steps=get_new_time(year, quarter)

      else:
        years, quarters, n_steps=get_new_time(year, quarter)
        predictions, maps= predict_meandering(model, last_known_input, n_steps, pca, years, quarters, scaler_year)
        m_cache.set(cache_key, (predictions, maps))
      unscaled_predictions = scaler_ts.inverse_transform(predictions)

      # the raw predicitons to do post processing for the standard overlay image 
      raw_df = pd.DataFrame(unscaled_predictions / 12, dtype=float, columns=['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist'])  

      # predictions converted to meters for the table
      transformed_predictions = (unscaled_predictions / 12) * 0.625
      predictions_df = pd.DataFrame({'year': years, 'quarter': quarters})
      targets = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist', 'c7_dist', 'c8_dist']

      for i, col in enumerate(targets):
        predictions_df[col] = transformed_predictions[:, i]

      data_cache.set(cache_key, raw_df)

      predictions_df[targets] = predictions_df[targets] - inti_values[targets].values
      predictions_df[targets] = predictions_df[targets].astype(float).round(4)

      predictions_df['bend_1'] = np.abs((predictions_df['c1_dist'] - predictions_df['c2_dist']).astype(float).round(4))
      predictions_df['bend_2'] = np.abs((predictions_df['c3_dist'] - predictions_df['c4_dist']).astype(float).round(4))
      predictions_df['bend_3'] = np.abs((predictions_df['c7_dist'] - predictions_df['c8_dist']).astype(float).round(4))

      return predictions_df
      
    except Exception as e:
      return f'no predictions generated due to \n{e}'
  else:
    past_vals=pd.read_csv(past_migration_vals, index_col=0)
    return get_past_meandering_values(past_vals, year, quarter)
  


