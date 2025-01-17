from flask import Flask, request
import atexit
import os
import shutil
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import clear_images, send_map_to_api
from utils.com_cache import m_cache, init_cache

# Flask constructor takes the name of 
# current module (__name__) as argument.
app = Flask(__name__)
init_cache(app)

def clean_up():
    IMAGE_FOLDER=r'data_dir\meander_migration_sal_maps'
    if os.path.exists(IMAGE_FOLDER):
        shutil.rmtree(IMAGE_FOLDER)  
        print(f"Cleared all images in {IMAGE_FOLDER}")
    
    # Clear cache
    m_cache.clear()
    print("Cleared all cache")
    
atexit.register(clean_up)
        
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

@app.get('/meander_migration/params/explain_migration/')
def get_saliency():
    query=request.args.to_dict()
    y=int(query['year'])
    q=int(query['quart'])
    map_idx=int(query['idx'])
    t=send_map_to_api(y, q, map_idx)
    return t
    
    
    

if __name__ == '__main__':
    app.run(debug=True)