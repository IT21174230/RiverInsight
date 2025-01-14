from flask import Flask
from utils.meander_migration import return_to_hp
from utils.meander_migration_xai import clear_images
# import threading
# import queue

# Flask constructor takes the name of 
# current module (__name__) as argument.
app = Flask(__name__)

# task_queue=queue.Queue()
#  using a separe thread to handle GUI OPs
# def worker():
#     while True:
#         item = task_queue.get()  
#         if item is None:  
#             break
#         # stop worker if no tasks

#         # Unpack the task tuple
#         task_function, *args = item  
#         try:
#             task_function(*args)  # Call the function with arguments
#         except Exception as e:
            # print(f"Error executing task: {e}")
        
@app.route('/')
def homepage():
    return 'Homepage'

@app.route('/meander_migration')
def meander_prediction():
    df=return_to_hp()
    clear_images()
    return df

if __name__ == '__main__':
    app.run(debug=True)