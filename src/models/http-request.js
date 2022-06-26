'use strict';

const Refreshable = require('./refreshable');
const Cacheable = require('./cacheable');
const Composite = require('./composite');
const HttpResponse = require('./http-response');
const get_params = require('../lib/get-params');

class HttpRequest {

    constructor() {
        this.http_response = new HttpResponse(this);
    }

    get local_cache() {
        return null;
    }

    get redis_cache() {
        return null;
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

        if (this.is_blocked(ctx)) {

            this.http_response.handle_nocache_request(ctx, 403, {message: 'Forbidden'});

        } else if (this.is_throttled(ctx)) {

            this.http_response.handle_nocache_request(ctx, 429, {message: 'Too Many Requests'});

        } else {

            const params = this.get_params(ctx);

            if (!this.is_auth(ctx, params)) {

                this.http_response.handle_nocache_request(ctx, 401, {message: 'Unauthorized'});

            } else if (object instanceof Refreshable) {

                await this.handle_refreshable_request(ctx, params, object);

            } else if (object instanceof Composite) {

                await this.handle_composite_request(ctx, params, object);

            } else {

                this.http_response.handle_nocache_request(ctx, 500, {message: 'unknown object type'});

            }
        }
        
        const end_time = process.hrtime.bigint();
        const ms = (Number(end_time - start_time) / 1000000).toFixed(2);

        ctx.set('X-Response-Time', `${ms} ms`);
    }

    async handle_refreshable_request(ctx, params, refreshable) {
    
        try {
        
            const cacheable = new Cacheable({params, refreshable});
        
            if (params.ss_rand) {
                if (await cacheable.get()) {
                    this.http_response.handle_nocache_request(ctx, 200, cacheable.data, cacheable.content_type);
                    return true;
                } else {
                    this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
                }
            } else {
                if (await cacheable.get(this.local_cache, this.redis_cache)) {
                    this.http_response.handle_cacheable_request(ctx, cacheable);
                    return true;
                } else {
                    this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
                }
            }
            
        } catch (err) {

            if (err.message.startsWith('Not Found')) {
                this.http_response.handle_nocache_request(ctx, 404, {message: err.message});
            } else {
                console.error(err);
                this.http_response.handle_nocache_request(ctx, 500, {message: err.message});
            }
        }
        
        return false;
    }

    async handle_composite_request(ctx, params, composite)  {
    
        const data = {};
    
        if (params.handle) {
            const config = get_config(params.handle, true);
            if (config && config.attributes) {
                Object.assign(data, config.attributes);
            }
        }
    
        const now_ms = Date.now();
    
        const result = { params: [], data, timestamp: now_ms, modified_time: now_ms, ttl: 1800000 };
    
        const promises = [];
    
        for (const [key, value] of Object.entries(composite)) {
            if (value instanceof Refreshable) {
                data[key] = null;
                promises.push(this.run_refreshable(key, params, value, result));
            } else if (typeof value !== 'function') {
                if (data[key] === undefined) data[key] = value;
            }
        }
    
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    
        composite.transform(data, params);
    
        if (params.ss_rand) {
            this.http_response.handle_nocache_request(ctx, 200, data);
        } else {
            this.http_response.handle_cacheable_request(ctx, new Cacheable(result));
        }
    
        return true;
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
                result.data[key] = {message: err.message};
            }
        }
    }
}

module.exports = HttpRequest;