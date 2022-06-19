'us strict';

const get_class_config = require('./get-class-config');

/**
 * note for permanent, only used for two purposes: 
 * 1) throttle (not refreshable), due to window_secs can not limited by default_ttl
 * 2) configs, to enable get config data without delay
 */

class LocalCache {

    constructor(redis_cache, config = {}) {
        if (redis_cache) this.redis_cache = redis_cache;
        Object.assign(this, get_class_config(this, config));
        this.cache_data = new Map();
        this.maintenance();
    }

    get size() {
        return this.cache_data.size;
    }

    save(cacheable) {
        if (this.cache_data.size > this.max_size * 1.33) {
            this.remove_expired(false);
            if (this.cache_data.size >= this.max_size) {
                return false;
            }
        }
        const now_ms = Date.now();
        const { timestamp = now_ms } = cacheable;
        const ttl = cacheable.data_ttl - (now_ms - timestamp);
        if (ttl <= 0) return false;
        const expires_at = now_ms + (cacheable.permanent ? ttl : ttl < this.default_ttl ? ttl : this.default_ttl );
        //console.log(cacheable.plain_object)
        this.cache_data.set(cacheable.key, {expires_at, ...cacheable.plain_object});
        return true;
    }

    load(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        if (!value.permanent && Date.now() >= value.expires_at) return false;
        cacheable.plain_object = value;
        return true;
    }

    get(key) {
        const value = this.cache_data.get(key);
        if (!value) return null;
        if (!value.permanent && Date.now() >= value.expires_at) return null;
        return value.data;
    }

    has(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        if (Date.now() >= value.expires_at) return false;
        return true;
    }

    /**
     * @param {*} cacheable 
     * @returns 
     */
    delete(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        return this.cache_data.delete(cacheable.key);
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
        this.timer_handle = setInterval(async () => {
            const start_ms = Date.now();
            this.remove_expired();
        }, this.timer_interval);
    }

    remove_expired() {
        for (const [key, value] of this.cache_data.entries()) {
            const {expires_at, permanent} = value;
            if (permanent) continue;
            if (Date.now() >= expires_at) {
                this.cache_data.delete(key);
            }
        }
    }
}

module.exports = LocalCache;