'use strict';

//const util = require('util');

const Cacheable = require('../lib/cacheable');
const Refreshable = require('../lib/refreshable');

module.exports = async (ctx, params, composite) => {

    const now_ms = Date.now();
    const data = params.attributes ? { ...params.attributes } : {};
    const result = { params: [], aggregated_params: {}, data, timestamp: now_ms, modified_time: now_ms, ttl: 1800000 };

    const promises = [];

    for (const [key, value] of Object.entries(composite)) {
        if (value instanceof Refreshable) {
            data[key] = null;
            promises.push(run_refreshable(key, params, value, result));
        } else if (typeof value !== 'function') {
            if (data[key] !== undefined) data[key] = value;
        }
    }

    if (promises.length > 0) {
        await Promise.all(promises);
    }

    composite.transform(data, result.aggregated_params);

    const { http_response } = global.PfapiApp;

    if (params.ss_rand) {
        http_response.handle_simple_request(ctx, 200, data);
    } else {
        http_response.handle_cacheable_request(ctx, new Cacheable(result));
    }

    return true;
}

async function run_refreshable(key, params, refreshable, result) {

    try {
    
        const { local_cache, redis_cache } = global.PfapiApp;

        const cacheable = new Cacheable({params, refreshable});
    
        if (params.ss_rand) {
            if (!await cacheable.get()) {
                result.data[key] = {message: 'Not Found'};
                return;
            }
        } else {
            if (await cacheable.get(local_cache, redis_cache)) {
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

        const tp = { ...cacheable.params };
        for (const [key, value] of Object.entries(tp)) {
            if (value === undefined || value === null) {
                delete tp[key];
            }
        }
        Object.assign(result.aggregated_params, tp);

    } catch (err) {
        if (err.message.startsWith('Not Found')) {
            result.data[key] = {message: err.message};
        } else {
            console.error(err);
            result.data[key] = {message: err.message};
        }
    }
}