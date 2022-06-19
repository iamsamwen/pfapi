'use strict';

const { get_prefix_key } = require('../lib/redis-keys');
const { on_invalidate, off_invalidate } = require('../lib/redis-invalidate');

/**
 * watch EXP key delete and expire events from redis
 * push it into refresh priority queue
 */
class EvictionWatch {

    constructor(redis, refresh_queue) {
        if (!redis) {
            throw new Error('missing required redis and/or refresh_queue');
        }
        this.redis = redis;
        if (refresh_queue) this.refresh_queue = refresh_queue;
    }

    async start() {
        this.expiration_client = await this.on_exp_invalidate(async (redis_keys) => {
            //console.log(`EvictionWatch receives ${redis_keys.length} redis_keys`);
            const keys = [];
            for (const redis_key of redis_keys) {
                if (await this.has_exp_key(redis_key)) continue;
                const {prefix, key} = get_prefix_key(redis_key);
                if (prefix !== 'EXP') continue;
                keys.push(key);
            }
            if (keys.length > 0) {
                await this.on_expires(keys);
            }
        });
    }
    
    async has_exp_key(exp_key) {
        const client = await this.redis.get_client();
        const value = await client.exists(exp_key);
        if (value) return true;
        else return false;
    }

    async on_expires(keys) {
        console.log(`on_expires received, ${keys.length} keys`, keys);
        if (!this.refresh_queue) return;
        await this.refresh_queue.push(keys);
    }

    async stop() {
        if (!this.expiration_client) return;
        await this.turnoff_exp_invalidate();
        await this.redis.close(this.expiration_client);
    }

    // support functions

    async on_exp_invalidate(on_event) {
        const {subscribe_client, id} = await on_invalidate(this.redis, {prefix: 'EXP::', noloop: false, on_event});
        if (subscribe_client) {
            this.exp_invalidate_id = id;
            return subscribe_client;
        }
        return null;
    }

    async turnoff_exp_invalidate() {
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

    async turnoff_data_invalidate() {
        if (this.data_invalidate_id) {
            const id = this.data_invalidate_id;
            delete this.data_invalidate_id;
            return await off_invalidate(this.redis, id);
        }
        return false;
    }
}

module.exports = EvictionWatch;
