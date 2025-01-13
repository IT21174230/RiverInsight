import pandas as pd
import numpy as np
import joblib
import tensorflow as tf
from sklearn.preprocessing import StandardScaler

model_meandering_tcn=r'model\0_85_0_59_filt3_6feat.joblib'
scaler_year=r'data_dir\scaler_year.pkl'
scaler_ts=r'data_dir\scaler_ts.pkl'
last_known_input=r'data_dir\last_known_input.pkl'
pca=r'data_dir\pca_obj.pkl'

model_meandering_tcn=joblib.load(model_meandering_tcn)
scaler_year=joblib.load(scaler_year)
scaler_ts=joblib.load(scaler_ts)
last_known_input=joblib.load(last_known_input)
pca=joblib.load(pca)

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

    # # Cyclical encoding for year (you can normalize the year value if needed)
    # df['year_sin'] = np.sin(2 * np.pi * (df['year'] - df['year'].min()) / (df['year'].max() - df['year'].min()))
    # df['year_cos'] = np.cos(2 * np.pi * (df['year'] - df['year'].min()) / (df['year'].max() - df['year'].min()))

    df['year_scaled'] = scaler.transform(df[['year']])  # Use double brackets to make it 2D    return df

    return df


def predict_meandering(model, last_known_input, n_steps, pca, years, quarters, scaler_year ):
    """
    Predicts beyond the test set by iteratively predicting the next step.

    Parameters:
    - model: Trained model.
    - last_known_input: Last known input data (shape should be (input_steps, num_input_features)).
    - n_steps: Number of steps to predict beyond the test set.
    - scaler: If you need to reverse scale the predictions, provide the scaler (optional).

    Returns:
    - predictions: Predicted values for the next n steps.
    """
    predictions = []
    current_input = last_known_input
    time_df=pd.DataFrame({'year': years, 'quarter': quarters})
    time_df=add_time_features(time_df, scaler_year)
    time_features = time_df[['quarter_sin', 'quarter_cos', 'year_scaled']].values


    for _ in range(n_steps):
        print(f'timesep:{_}')

        # Make prediction for the next step
        if _ ==0:
          pred = model.predict(np.expand_dims(current_input, axis=0))  # Shape (1, input_steps, num_input_features)

          predictions.append(pred.flatten())  # Flatten to get a 1D prediction
        elif _==1:
          redundant_pred=predictions[-1]
          pca_feat=pca.transform(redundant_pred.reshape(1, -1))
          time=time_features[0]
          time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time_reshaped], axis=1)
          last_known=last_known_input[-3:]
          final_array = np.vstack([last_known, concatenated])
          pred=model.predict(np.expand_dims(final_array, axis=0))
          predictions.append(pred.flatten())

        elif _==2:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:2]
          # time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-2:]
          final_array = np.vstack([last_known, concatenated])
          pred=model.predict(np.expand_dims(final_array, axis=0))
          predictions.append(pred.flatten())
        elif _==3:
          redundant_pred=predictions
          pca_feat=pca.transform(redundant_pred)
          time=time_features[:3]
          # time_reshaped = time.reshape(1, -1)  # Shape: (1, n_time_features)

          # # Concatenate pca_feat and time_reshaped along axis 1
          concatenated = np.concatenate([pca_feat, time], axis=1)
          last_known=last_known_input[-1:]
          final_array = np.vstack([last_known, concatenated])
          pred=model.predict(np.expand_dims(final_array, axis=0))
          predictions.append(pred.flatten())
        else:
          redundant_pred=predictions[-4:]
          pca_feat=pca.transform(redundant_pred)
          time=time_features[(_-3):_+1, :]
          concatenated = np.concatenate([pca_feat, time], axis=1)
          pred=model.predict(np.expand_dims(concatenated, axis=0))
          predictions.append(pred.flatten())


          # print(time_df.iloc[_])

    return np.array(predictions)
  
years, quarters, n_steps=get_new_time(2025, 3)

def return_to_hp():
  try:
    predictions = predict_meandering(model_meandering_tcn, last_known_input, n_steps, pca, years, quarters, scaler_year)
    unscaled_predictions=scaler_ts.inverse_transform(predictions)
    predictions_df=pd.DataFrame({'year': years, 'quarter': quarters})
    targets = ['c1_dist', 'c2_dist', 'c3_dist', 'c4_dist','c7_dist','c8_dist']
    for i, col in enumerate(targets):
      predictions_df[col] = unscaled_predictions[:, i]
    return predictions_df
  except:
    return 'no predictions generated'

