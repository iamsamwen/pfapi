'use strict';

const { get_prefix_key } = require('../lib/redis-keys');
const { on_invalidate, off_invalidate} = require('../lib/redis-invalidate');

/**
 * watch data invalidate events from redis
 * delete it from local cache
 */
class LocalInvalidate {
    
    constructor(redis, local_cache) {
        if (!redis) {
            throw new Error('missing required redis');
        }
        this.redis = redis;
        if (local_cache) this.local_cache = local_cache;
    }

    async start() {
        this.invalidate_client = await this.on_data_invalidate(async (redis_keys) => {
            for (const redis_key of redis_keys) {
                const {prefix, key} = get_prefix_key(redis_key);
                if (prefix !== 'DATA') continue;
                this.on_key_invalidate(key);
            }
        });
    }

    on_key_invalidate(key) {
        if (!this.local_cache) return;
        return this.local_cache.delete({key});
    }

    async stop() {
        if (!this.invalidate_client) return;
        await this.turnoff_data_invalidate();
        await this.redis.close(this.invalidate_client);
    }

    async turnoff_data_invalidate() {
        if (this.exp_invalidate_id) {
            const id = this.exp_invalidate_id;
            delete this.exp_invalidate_id;
            return await off_invalidate(this.redis, id);
        }
        return false;
    }

    async on_data_invalidate(on_event) {
        const {subscribe_client, id} = await on_invalidate(this.redis, {prefix: 'DATA::', noloop: true, on_event});
        if (subscribe_client) {
            this.data_invalidate_id = id;
            return subscribe_client;
        }
        return null;
    }

}

module.exports = LocalInvalidate;