from flask_caching import Cache

# meandering cache
m_cache=Cache()
data_cache=Cache()

def init_cache(app):
    m_cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})
    data_cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})