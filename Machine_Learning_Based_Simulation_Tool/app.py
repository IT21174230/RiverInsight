from flask import Flask, request
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import clear_images

# Flask constructor takes the name of 
# current module (__name__) as argument.
app = Flask(__name__)

        
@app.route('/')
def homepage():
    return 'Homepage'


@app.get('/meander_migration/params/')
def predict_meander():
    query=request.args.to_dict()
    y=int(query['year'])
    q=int(query['quart'])
    df=return_to_hp(y,q)
    try:
        return df.to_html()
    except:
        return df
    

if __name__ == '__main__':
    app.run(debug=True)