'use strict';

const { get_prefix_key } = require('../lib/redis-keys');
const { on_invalidate, off_invalidate } = require('../lib/redis-invalidate');

/**
 * watch EXP key delete and expire events from redis
 * push it into refresh priority queue
 */
class ExpiresWatch {

    constructor(redis, refresh_queue) {
        if (!redis || !refresh_queue) {
            throw new Error('missing required redis and/or refresh_queue');
        }
        this.redis = redis;
        if (refresh_queue) this.refresh_queue = refresh_queue;
    }

    async start() {
        this.expiration_client = await this.on_exp_invalidate(async (redis_keys) => {
            //console.log(`*** EvictionWatch receives ${redis_keys.length} redis_keys`, redis_keys);
            const keys = [];
            for (const redis_key of redis_keys) {
                if (!redis_key.startsWith('EXP::')) continue;
                if (!await this.is_key_expired(redis_key)) continue;
                const {key} = get_prefix_key(redis_key);
                if (!key) continue;
                //console.log('key expired', key)
                keys.push(key);
            }
            if (keys.length > 0) {
                await this.on_expires(keys);
            }
        });
    }
    
    async is_key_expired(exp_key) {
        const client = await this.redis.get_client();
        const no_exp_key = 'NO-' + exp_key;
        const multi = client.multi();
        multi.exists(exp_key);
        multi.exists(no_exp_key);
        const result = await multi.exec();
        if (result.length !== 2) return false;
        if (result[0][1] === 1) return false;
        if (result[1][1] === 1) return false;
        return true;
    }

    async on_expires(keys) {
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
        const {subscribe_client, id} = await on_invalidate(this.redis, on_event, {prefix: 'EXP::', noloop: false});
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
        const {subscribe_client, id} = await on_invalidate(this.redis, on_event, {prefix: 'DATA::', noloop: true});
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

module.exports = ExpiresWatch;
