'use strict';

const Refreshable = require('./refreshable');
const Cacheable = require('./cacheable');
const Composite = require('./composite');
const HttpResponse = require('./http-response');
const get_params = require('../utils/get-params');
const uids_config = require('../app/uids-config');

class HttpRequest {

    constructor() {
        this.http_response = new HttpResponse(this);
    }

    get_params(ctx) {
        return get_params(ctx);
    }

    is_blocked(ctx) {
        return false;
    }

    is_throttled(ctx) {
        return false;
    }

    is_auth(ctx, params) {
        return true;
    }

    /**
     * 
     * @param {*} ctx 
     * @param {*} object Refreshable or Composite
     */
    async handle(ctx, object) {

        const start_time = process.hrtime.bigint();

        let cache_key;

        if (this.is_blocked(ctx)) {

            this.http_response.handle_nocache_request(ctx, 403, {message: 'Forbidden'});

        } else if (this.is_throttled(ctx)) {

            this.http_response.handle_nocache_request(ctx, 429, {message: 'Too Many Requests'});

        } else {

            const params = this.get_params(ctx);

            if (!this.is_auth(ctx, params)) {

                this.http_response.handle_nocache_request(ctx, 401, {message: 'Unauthorized'});

            } else if (object instanceof Refreshable) {

                cache_key = await this.handle_refreshable_request(ctx, params, object);

            } else if (object instanceof Composite) {

                cache_key = await this.handle_composite_request(ctx, params, object);

            } else {

                this.http_response.handle_nocache_request(ctx, 500, {message: 'unknown object type'});

            }
        }
        
        const end_time = process.hrtime.bigint();
        const ms = (Number(end_time - start_time) / 1000000).toFixed(2);

        ctx.set('X-Response-Time', `${ms} ms`);

        if (process.env.DEBUG) {
            console.log('cache_key:', cache_key, 'response_time:', ms, 'ms');
        }
    }

    async handle_refreshable_request(ctx, params, refreshable) {
    
        let cacheable;

        try {
        
            cacheable = new Cacheable({params, refreshable});
        
            if (params.ss_rand) {

                if (await cacheable.get()) {

                    this.http_response.handle_nocache_request(ctx, 200, cacheable.data, cacheable.content_type);

                } else {

                    this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});

                }
            } else {

                if (await cacheable.get(this.local_cache, this.redis_cache)) {

                    this.http_response.handle_cacheable_request(ctx, cacheable);

                } else {

                    this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
                }
            }
            
        } catch (err) {

            if (err.message.startsWith('Not Found')) {

                this.http_response.handle_nocache_request(ctx, 404, {message: err.message});

            } else {

                console.error(err);
                this.http_response.handle_nocache_request(ctx, 500, {message: 'failed'});
            }
        }
        
        return cacheable ? cacheable.key : null;
    }

    async handle_composite_request(ctx, params, composite)  {
    
        const data = {};
    
        if  (params.handle && this.get_config) {
            const config = ctx.state.pfapi.config;
            if (config && config.attributes) {
                Object.assign(data, config.attributes);
            }
        }
    
        const now_ms = Date.now();
    
        const result = { params: [], data, timestamp: now_ms, modified_time: now_ms, ttl: 1800000 };
    
        const promises = [];
    
        for (const [key, value] of Object.entries(composite)) {
            if (value instanceof Refreshable) {
                promises.push(this.run_refreshable(key, params, value, result));
            } else if (data[key] === undefined) {
                data[key] = value;
            }
        }
    
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    
        composite.transform(data, params);
    
        let cacheable;

        if (params.ss_rand) {
            this.http_response.handle_nocache_request(ctx, 200, data);
        } else {
            cacheable = new Cacheable(result);
            this.http_response.handle_cacheable_request(ctx, cacheable);
        }
    
        return cacheable ? cacheable.key : null;
    }

    async run_refreshable(key, params, refreshable, result) {

        try {
    
            const cacheable = new Cacheable({params, refreshable});
        
            if (params.ss_rand) {
                if (!await cacheable.get()) {
                    result.data[key] = {message: 'Not Found'};
                    return;
                }
            } else {
                if (await cacheable.get(this.local_cache, this.redis_cache)) {
                    const { timestamp, modified_time, ttl } = cacheable.plain_object;
                    if (timestamp < result.timestamp) result.timestamp = timestamp;
                    if (modified_time < result.modified_time) result.modified_time = modified_time;
                    if (ttl < result.ttl) result.ttl = ttl;
                } else {
                    result.data[key] = {message: 'Not Found'};
                    return;
                }
            }
            
            result.data[key] = cacheable.data;
            result.params.push(cacheable.key);
    
        } catch (err) {
            if (err.message.startsWith('Not Found')) {
                result.data[key] = {message: err.message};
            } else {
                console.error(err);
                result.data[key] = {message: 'failed'};
            }
        }
    }
}

module.exports = HttpRequest;