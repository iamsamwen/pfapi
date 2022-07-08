'use strict';

const fp = require('lodash/fp');

const Refreshable = require('./refreshable');
const Cacheable = require('./cacheable');
const Composite = require('./composite');
const get_params = require('../utils/get-params');
const logging = require('../app/logging');

class HttpRequest {

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

    defense_ok(ctx) {
        if (ctx.state?.pfapi_defense_ok !== undefined) {
            return ctx.state.pfapi_defense_ok;
        }
        let ok = true;
        if (this.is_blocked(ctx)) {
            this.http_response.handle_error(ctx, 403, 'Forbidden');
            ok = false;
        } else if (this.is_throttled(ctx)) {
            this.http_response.handle_error(ctx, 429, 'Too Many Requests');
            ok = false;
        }
        if (ctx.state) ctx.state.pfapi_defense_ok = ok;
        else ctx.state = {pfapi_defense_ok: ok};
        return ok;
    }

    /**
     * 
     * @param {*} ctx 
     * @param {*} object Refreshable or Composite
     */
    async handle(ctx, object) {

        const start_time = process.hrtime.bigint();

        let cache_key;

        if (this.defense_ok(ctx)) {

            const params = this.get_params(ctx);

            if (!this.is_auth(ctx, params)) {

                this.http_response.handle_error(ctx, 401, 'Unauthorized');

            } else if (object instanceof Refreshable) {

                cache_key = await this.handle_refreshable_request(ctx, params, object);

            } else if (object instanceof Composite) {

                cache_key = await this.handle_composite_request(ctx, params, object);

            } else {

                this.http_response.handle_error(ctx, 500, 'Server Internal Error', 'handle', {reason: 'unknown object type'});

            }
        }
        
        const end_time = process.hrtime.bigint();
        const ms = (Number(end_time - start_time) / 1000000).toFixed(2);

        if (this.config?.send_response_time) ctx.set('X-PFAPI-Response-Time', `${ms} ms`);

        logging.info(`key: ${cache_key} ${ms} ms ${ctx.path}`);
    }

    async handle_refreshable_request(ctx, params, refreshable) {
    
        let cacheable;

        try {
        
            cacheable = new Cacheable({params, refreshable});
        
            if (params.ss_rand) {

                if (await cacheable.get()) {

                    this.http_response.handle_nocache_request(ctx, 200, cacheable.data, cacheable.content_type);

                } else {

                    this.http_response.handle_error(ctx, 404, 'Not Found', 'handle_refreshable_request');

                }
            } else {

                if (await cacheable.get(this.local_cache, this.redis_cache)) {

                    this.http_response.handle_cacheable_request(ctx, cacheable);

                } else {

                    this.http_response.handle_error(ctx, 404, 'Not Found', 'handle_refreshable_request');
                }
            }
            
        } catch (err) {

            if (err.message.startsWith('Not Found')) {

                this.http_response.handle_error(ctx, 404, 'Not Found', 'handle_refreshable_request', {reason: err.message});

            } else {

                logging.error(err);
                this.http_response.handle_error(ctx, 500, 'Server Internal Error', 'handle_refreshable_request', {reason: err.message});
            }
        }
        
        return cacheable ? cacheable.key : null;
    }

    async handle_composite_request(ctx, params, composite)  {
    
        const data = {};

        const result = { data, params : [] };
    
        const config = params.handle && this.get_handle_config ? this.get_handle_config(params.handle) : null;

        if (config) {
            if (config.attributes) {
                Object.assign(data, config.attributes);
            }
            // this forces the composite key change if config checksum changed
            result.params.push(config.checksum);
            result.modified_time = config.modified_time;
            result.timestamp = config.timestamp;
        }

        const promises = [];
    
        for (const [key, value] of Object.entries(composite)) {
            if (value instanceof Refreshable) {
                promises.push(this.run_refreshable(key, fp.cloneDeep(params), value, result));
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
                    if (!result.timestamp) result.timestamp = timestamp;
                    else if (result.timestamp < timestamp) result.timestamp = timestamp;
                    if (!result.modified_time) result.modified_time = modified_time;
                    else if (result.modified_time < modified_time) result.modified_time = modified_time;
                    if (result.ttl > ttl) result.ttl = ttl;
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
                logging.error(err);
                result.data[key] = {message: 'failed'};
            }
        }
    }
}

module.exports = HttpRequest;