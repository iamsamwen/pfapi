'us strict';

const get_class_config = require('../lib/get-class-config');

/**
 * 
 * permanent = true is used for configs, to enable get config data without delay
 *
 */

class LocalCache {

    constructor(config = {}) {
        Object.assign(this, get_class_config(this, config));
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
        const plain_object = cacheable.plain_object;
        plain_object.expires_at = now_ms + ( ttl < this.default_ttl ? ttl : this.default_ttl );
        this.cache_data.set(cacheable.key, plain_object);
        return true;
    }

    load(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        if (!value.permanent && Date.now() >= value.expires_at) return false;
        cacheable.plain_object = value;
        return true;
    }

    put(key, data, ttl = true) {
        const now_ms = Date.now();
        const object = { data };
        if (ttl === true) {
            object.permanent = true;
        } else if (typeof ttl === 'number') {
            object.ttl = ttl;
            object.expires_at = now_ms + ttl;
        } else {
            object.expires_at = now_ms + this.default_ttl;
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

    has(cacheable) {
        const value = this.cache_data.get(cacheable.key);
        if (!value) return false;
        if (!value.permanent && Date.now() >= value.expires_at) return false;
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
        this.timer_handle = setInterval(() => {
            for (const [key, value] of this.cache_data.entries()) {
                const {expires_at, permanent} = value;
                if (permanent) continue;
                if (Date.now() >= expires_at) {
                    this.cache_data.delete(key);
                }
            }
        }, this.timer_interval);
    }
}

module.exports = LocalCache;