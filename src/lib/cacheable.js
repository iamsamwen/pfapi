'use strict';

const get_checksum = require('./get-checksum');
const get_cache_key = require('./get-cache-key');
const get_class_config = require('./get-class-config');
const get_body = require('./get-body');
const info_keys = require('./info-keys'); 
const get_dependency_key = require('./get-dependency-key');
const update_params = require('./update-params');

const Refreshable = require('./refreshable');

class Cacheable {

    /**
     * constructor
     * 
     * @param {*} object can have keys in info_keys, 'key', 'data', 'dependent_keys' and refreshable object
     * @param {*} config per type of instance config, used with params for calling reduce and get_data 
     */
    constructor(object) {
        if (object.refreshable) {
            this.refreshable = object.refreshable;
            this.module_path = this.refreshable.module_path;
        }
        this.plain_object = object;
        this.config = get_class_config(this);
        if (process.env.NODE_ENV === 'test') this.from = '';
    }

    /**
     * it tries to get the data from local cache first, then redis cache, finally from refreshable get_data
     * it updates caches that don't have the data
     *  
     * @param {*} local_cache an instance of LocalCache
     * @param {*} redis_cache an instance of RedisCache
     * @returns true if succeeded, otherwise false
     */
    async get(local_cache, redis_cache) {
        if (local_cache && local_cache.load(this)) {
            if (process.env.NODE_ENV === 'test') this.from = 'local';
            return true;
        }
        if (redis_cache) {
            if (await redis_cache.get_cacheable(this)) {
                if (local_cache) local_cache.save(this);
                if (process.env.NODE_ENV === 'test') this.from = 'redis';
                if (this.is_refreshable) this.early_refresh(redis_cache);
                return true;
            }
        }
        if (await this.fetch_data(redis_cache)) {
            if (local_cache && this.data !== undefined && this.data !== null) {
                local_cache.save(this);
            }
            if (process.env.NODE_ENV === 'test') this.from = 'fetch';
            return true;            
        }
        return false;
    }

    /**
     * it updates local and redis caches by call refreshable.
     *  
     * @param {*} local_cache an instance of LocalCache
     * @param {*} redis_cache an instance of RedisCache
     * @returns true if succeeded, otherwise false
     */
    async update(local_cache, redis_cache) {
        if (!local_cache && !redis_cache) {
            return false;
        }
        const previous_checksum = this.checksum;
        if (await redis_cache.get_cacheable(this)) {
            // local_refreshed by other instances
            if (previous_checksum !== this.checksum) {
                local_cache.save(this);
                if (process.env.NODE_ENV === 'test') this.from = 'redis';
                return true;
            }
        }
        if (await this.fetch_data(redis_cache, local_cache) && 
            this.data !== undefined && this.data !== null) {
            if (local_cache) local_cache.save(this);
            if (process.env.NODE_ENV === 'test') this.from = 'fetch';  
            if (local_cache) local_cache.save(this);
            return true;
        } else {
            console.error('set, failed to fetch_data data', this.module_path);
            return false;
        }
    }

    /**
     * delete the cacheable from redis and local cache
     * 
     * @param {*} local_cache an instance of LocalCache
     * @param {*} redis_cache an instance of RedisCache
     */
    async del(local_cache, redis_cache) {
        const result = await redis_cache.delete(this);
        local_cache.delete(this);
        return result;
    }

    get is_refreshable() {
        return !!this.module_path;
    }

    /**
     * convert to plain old javascript object
     * 
     * @returns 
     */
    get plain_object() {
        const plain_object = {key: this.key, data: this.data};
        for (const key of info_keys) {
            if (this.hasOwnProperty(key)) {
                plain_object[key] = this[key];
            }
        }
        return plain_object;
    }

    /**
     * convert from plain object
     * 
     * @param {*} plain_object  
     */
    set plain_object(plain_object) {
        if (plain_object.key) this.key = plain_object.key;
        if (plain_object.data !== undefined) this.data = plain_object.data;
        if (plain_object.dependent_keys) this.dependent_keys = plain_object.dependent_keys;
        for (const key of info_keys) {
            if (plain_object.hasOwnProperty(key)) {
                if (key === 'ttl' && this.ttl) continue;
                this[key] = plain_object[key];
            }
        }
        if (!this.refreshable && this.module_path) {
            this.refreshable = new Refreshable(this.module_path);
        }
        if (this.refreshable) {
            update_params(this.params);
            this.params = this.refreshable.reduce(this.params);
            const key = get_cache_key(this);
            if (!this.key) this.key = key;
            else if (this.key !== key) {
                delete this.timestamp;
                delete this.created_time;
                delete this.duration;
                this.key = key;
            }
        } else if (!this.key) {
            this.key = get_cache_key(this);
        }
        if (!this.checksum && this.hasOwnProperty('data')) {
            this.checksum = get_checksum(this.data);
        }
    }

    // helper function, update info from redis result
    //
    set info(result) {
        for (const key in result) {
            if (!info_keys.includes(key)) continue;
            if (key === 'ttl' && this.ttl) continue;
            let value = result[key];
            if (typeof value === 'string' && value !== '') {
                if (!isNaN(value)) value = Number(value);
                else if ((value.startsWith('{') && value.endsWith('}')) ||
                    (value.startsWith('[') && value.endsWith(']'))) {
                    try {
                        value = JSON.parse(value);
                    } catch(err) {
                        //console.error(err.message);
                    }
                }
            }
            this[key] = value;
        }
        if (this.module_path && !this.refreshable) {
            this.refreshable = new Refreshable(this.module_path);
        }
    }

    // helper function, prepare for redis set data
    //
    get data_value() {
        if (this.data === undefined || this.data === null) {
            throw new Error('data is empty');
        }
        return get_body(this.data);
    }

    // helper function, parse result from redis get data
    //
    set data_value(value) {
        if (typeof value === 'string' && value !== '') {
            if (['true', 'false'].includes(value)) {
                value = (value === 'true');
            } else if (!isNaN(value)) {
                value = Number(value);
            } else if (
                (value.startsWith('{') && value.endsWith('}')) ||
                (value.startsWith('[') && value.endsWith(']'))
            ) {
                try {
                    value = JSON.parse(value);
                } catch(err) {
                    //console.error(err.message);
                }
            }
        }
        this.data = value;
    }

    // helper function, prepare hmset args for info
    //
    get info_args() {
        // count does't update, only do increments
        const args = [];
        for (const key of info_keys) {
            if (key === 'count' || !this.hasOwnProperty(key)) continue;
            args.push(key);
            let value = this[key];
            if (typeof value === 'object') value = JSON.stringify(value);
            args.push(value);
        }
        return args;
    }

    // to delay the decision of using default to the time needs it
    //
    get data_ttl() {
        if (!this.hasOwnProperty('ttl')) {
            this.ttl = this.config.ttl;
        }
        return this.ttl;
    }

    // for slow get_data calls, extra_ttl will help the refresh mechanism 
    // to avoid calling it during serving the actual request
    //
    get extra_ttl() {
        return this.duration >= this.config.slow_duration ? this.config.extra_ttl : 0;
    }
    
    get info_ttl() {
        return this.config.info_ttl; // typical 24 hours
    }

    // call within redis_cache, if it is fast enough, no need to setup refresh
    //
    get to_refresh() {
        return this.refreshable && this.duration >= this.config.refresh_duration;
    }

    /**
     * fetch data from source and save result to redis
     * 
     * @param {*} redis_cache 
     * @returns 
     */
     async fetch_data(redis_cache) {
        if (!this.params || !this.module_path) {
            if (!redis_cache || !await redis_cache.get_info(this)) {
                return false;
            }
        }
        if (!this.params || !this.module_path) {
            return false;
        }
        if (!this.refreshable) {
            this.refreshable = new Refreshable(this.module_path);
        }
        await this.get_data();
        if (this.data === null) {
            this.ttl = 0;
        }
        if (redis_cache) {
            await redis_cache.set_cacheable(this);
        } else {
            this.ttl = 0;
            if (this.permanent) this.permanent = false;
        }
        return true;
    }

    /**
     * calculate priority score 
     * 
     * @param {*} redis_cache 
     * @returns 
     */
    async calculate_priority_score(redis_cache) {
        if (!this.hasOwnProperty('duration') || !this.hasOwnProperty('count')) {
            await redis_cache.get_info(this);
        }
        const duration_factor = this.duration ? this.duration / this.config.slow_duration : 1;
        const age_ms = (Date.now() - this.created_time) || 1000;
        const usage_factor = (this.count ? this.count : 1) / age_ms * 1000;
        return duration_factor * duration_factor * usage_factor;
    }

    /**
     * for costly slow get data from source,
     * we can do early fetching when it closes to expiration
     * without delay on current call
     * 
     * @param {*} redis_cache 
     * @returns true if succeeded, otherwise false
     */
    early_refresh(redis_cache) {
        if (!this.timestamp || !this.hasOwnProperty('duration')) {
            console.error('early_refresh, missing timestamp and/or duration');
            return false;
        }
        if (this.duration < this.config.slow_duration) return false;
        const ttl = this.data_ttl;
        const left_ms = this.timestamp + ttl - Date.now();
        if (left_ms > this.config.early_refresh) return false;
        const handle = setTimeout(async () => {
            if (await this.fetch_data(redis_cache)) {
                if (process.env.NODE_ENV === 'test') this.from = 'early_refresh';
            }
            clearTimeout(handle);
        }, 100);
        handle.unref();
        return true;
    }

    /**
     * get_data, it consequently calls to get_data of refreshable.
     * assuming this.refreshable and this.params are ready
     * 
     * @returns no returns, throw exception if fails
     */
    async get_data() {
        const previous_checksum = this.checksum;
        const start_ms = Date.now();
        const result = await this.refreshable.get_data(this.params);
        if (!result || result.data === undefined || result.data === null) {
            throw new Error(`Not Found`);
        }
        this.data = result.data;
        this.timestamp = Date.now();
        if (!this.created_time) this.created_time = this.timestamp;
        this.duration = this.timestamp - start_ms;
        this.checksum = get_checksum(this.data);
        const changed = previous_checksum !== this.checksum;
        if (changed) this.modified_time = this.timestamp;
        if (result.metadata) {
            this.metadata = {};
            for (const key in result.metadata) {
                this.metadata[key.toLowerCase()] = result.metadata[key];
            }
        }
        if (result.dependencies && result.dependencies.length > 0) {
            this.dependent_keys = [];
            for (const dependency of result.dependencies) {
                if (!dependency) continue;
                const key = get_dependency_key(dependency);
                if (key) this.dependent_keys.push(key);
            }
        }
        return changed;
    }
}

module.exports = Cacheable;