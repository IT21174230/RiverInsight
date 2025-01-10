from flask import Flask, request
import pickle as pkl
import pandas as pd
import json
import numpy as np
from numpyencoder import NumpyEncoder
from datetime import datetime
from werkzeug.exceptions import HTTPException

app = Flask(__name__)

global model
with open('Machine_Learning_Based_Simulation_Tool /model/riverinsight_simulation_model.pkl', 'rb') as f:
    model = pkl.load(f)


def set_quarter_flags(df):
    # Create a dictionary of quarters with False values
    quarter_flags = {f'quarter_{i}': False for i in range(2, 5)}
    
    # Update the respective quarter flag based on the quarter value
    for i in range(2, 5):
        quarter_flag_column = f'quarter_{i}'
        df[quarter_flag_column] = df['quarter'].apply(lambda x: True if int(x) == i else False)
    return df

@app.route('/', methods=['POST'])
def inference_model():
    try:
        req_data = request.json
        request_body = req_data['body']
        date = request_body['date']
        rainfall = request_body['rainfall']
        temp = request_body['temp']
        print('date: ', date, 'rainfall: ', rainfall, 'temp: ', temp)

        data =  {'date': pd.to_datetime(date)}
        # date = pd.PeriodIndex(date, freq='M').to_timestamp()
        # Extract 'year' and calculate 'quarter'
        data['year'] = int(data['date'].year)
        data['quarter'] = str(((data['date'].month - 1) // 3) + 1)

        # Create a new column combining 'year' and 'quarter'
        data['year_quarter'] = str(data['year']) + '-' + str(data['quarter'])
        data['rainfall'] = float(rainfall)
        data['temperature'] = float(temp)

        data_df = pd.DataFrame(data, index=[0])
        # print(data_df.dtypes)
        # print(data)

        data_df = set_quarter_flags(data_df)
        print(data_df)

        features = ['year', 'rainfall', 'temperature', 'quarter_2', 'quarter_3', 'quarter_4']
        predicts = model.predict(data_df[features])
        # data_df = pd.get_dummies(data_df, columns=['quarter'], drop_first=True)
        print(predicts)
        
        return {
                'statusCode': 200,
                'body': json.dumps(predicts, cls=NumpyEncoder)
            }

    except HTTPException:
                    return{
                        'statusCode': 415,
                        'body':json.dumps([{"message":f"{'unsupportedmediatype: Send request as encoded json'}"}])
                    }
    except KeyError as e:
        return{
            'statusCode': 404,
            'body':json.dumps([{"message":f"{e , 'Key not found in request body'}"}])
        }
    except ValueError as e:
        return{
            'statusCode': 400, 
            'body':json.dumps([{"message":f"{e,'request body input is invalid'}"}])
        }
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps([{"message":f"{e}"}])
        }

if __name__ == '__main__':
    # inference_model()
    app.run()
