'use strict';

const get_config = require('../app/get-config');
const logging = require('../app/logging');

/**
 * 
 * permanent = true is used for configs, to enable get config data without delay
 *
 */

class LocalCache {

    constructor(config) {
        this.config = get_config('LocalCache');
        if (config) Object.assign(this.config, config);
        this.cache_data = new Map();
        this.maintenance();
    }

    get size() {
        return this.cache_data.size;
    }

    save(cacheable) {
        const now_ms = Date.now();
        const { timestamp = now_ms } = cacheable;
        const ttl = cacheable.data_ttl - (now_ms - timestamp);
        if (ttl <= 0) return false;
        const object = cacheable.plain_object;
        const default_ttl = this.config.default_ttl;
        object.expires_at = now_ms + ( ttl < default_ttl ? ttl : default_ttl );
        this.cache_data.set(cacheable.key, object);
        return true;
    }

    load(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        if (!value.permanent && Date.now() >= value.expires_at) return false;
        cacheable.plain_object = value;
        return true;
    }

    put(key, data, ttl) {
        const now_ms = Date.now();
        const object = { data };
        if (ttl === true) {
            object.permanent = true;
        } else if (typeof ttl === 'number') {
            object.ttl = ttl;
            object.expires_at = now_ms + ttl;
        } else {
            const default_ttl = this.config.default_ttl;
            object.expires_at = now_ms + default_ttl;
        }
        this.cache_data.set(key, object);
        return true;
    }

    get(key) {
        const value = this.cache_data.get(key);
        if (!value) return null;
        if (!value.permanent && Date.now() >= value.expires_at) return null;
        return value.data;
    }

    has(key) {
        const value = this.cache_data.get(key);
        if (!value) return false;
        if (!value.permanent && Date.now() >= value.expires_at) return false;
        return true;
    }

    delete(key) {
        const value = this.cache_data.get(key);
        if (!value) return false;
        return this.cache_data.delete(key);
    }

    get_with_info(key) {
        const value = this.cache_data.get(key);
        if (!value) return null;
        if (!value.permanent && Date.now() >= value.expires_at) return null;
        return value;
    }

    /**
     * for debug
     * @param {*} query 
     * @returns 
     */
    list(query) {
        const result = [];
        if (!query || Object.entries(query).length === 0) {
            const it = this.cache_data.keys();
            let next = it.next();
            while (!next.done) {
                const data = this.get(next.value)
                if (data) result.push({[next.value]: data});
                next = it.next();
            }
        } else {
            const it = this.cache_data.keys();
            let next = it.next();
            while (!next.done) {
                const data = this.get(next.value)
                if (data) {
                    let matched = true;
                    for (const key in query) {
                        matched = String(data[key]) === query[key];
                        if (!matched) break;
                    }
                    if (matched) result.push({[next.value]: data})
                }
                next = it.next();
            }
        }
        return result;
    }

    clear() {
        this.cache_data.clear();
    }
    
    stop() {
        if (this.timer_handle) {
            clearInterval(this.timer_handle);
            this.timer_handle.unref();
            this.timer_handle = null;
        }
        this.clear();
    }

    maintenance() {
        this.timer_handle = setInterval(() => {
            for (const [key, value] of this.cache_data.entries()) {
                const {expires_at, permanent} = value;
                if (permanent) continue;
                if (Date.now() >= expires_at) {
                    this.cache_data.delete(key);
                }
            }
            if (this.cache_data.size >= this.config.max_size) {
                logging.error(`local cache size reached max_size (${this.config.max_size})`);
            } else if (this.cache_data.size > this.config.max_size * 0.8) {
                logging.warn(`local cache size reached 80 percent of max_size (${this.config.max_size})`);
            }
        }, this.config.timer_interval);
    }
}

module.exports = LocalCache;