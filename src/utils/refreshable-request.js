'use strict';

const Cacheable = require('../models/cacheable');

module.exports = async (ctx, params, refreshable) => {

    const { local_cache, redis_cache, http_response } = global.PfapiApp;

    try {
    
        const cacheable = new Cacheable({params, refreshable});
    
        if (params.ss_rand) {
            if (await cacheable.get()) {
                http_response.handle_simple_request(ctx, 200, cacheable.data);
                return true;
            } else {
                http_response.handle_simple_request(ctx, 404, {message: 'Not Found'});
            }
        } else {
            if (await cacheable.get(local_cache, redis_cache)) {
                http_response.handle_cacheable_request(ctx, cacheable);
                return true;
            } else {
                http_response.handle_simple_request(ctx, 404, {message: 'Not Found'});
            }
        }
        
    } catch (err) {
        if (err.message.startsWith('Not Found')) {
            http_response.handle_simple_request(ctx, 404, {message: err.message});
        } else {
            console.error(err);
            http_response.handle_simple_request(ctx, 500, {message: err.message});
        }
    }
    
    return false;
}