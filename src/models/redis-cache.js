'use strict';

const { get_redis_key } = require('../lib/redis-keys');
const RedisBase = require('../lib/redis-base');

class RedisCache extends RedisBase {
    
    async get_cacheable(cacheable) {
        if (!cacheable.key) {
            throw new Error('get_cacheable, no key in cacheable object');
        }
        const client = await this.get_client();
        const data_key = get_redis_key('DATA', cacheable.key);
        const info_key = get_redis_key('INFO', cacheable.key);
        const multi = client.multi();
        multi.hgetall(info_key);
        multi.get(data_key);
        const result = await multi.exec();
        if (result.length !== 2) return false;
        if (!result[0][1] || Object.keys(result[0][1]).length === 0) return false;
        else cacheable.info = result[0][1];
        if (result[1][1] === null) return false;
        cacheable.data_value = result[1][1];
        client.hincrby(info_key, 'count', 1).then((x) => cacheable.count = x);
        return true;
    }

    async set_cacheable(cacheable) {
        if (!cacheable.key || (cacheable.data === null || cacheable.data === undefined)) {
            throw new Error('set_cacheable, no key or/and data in cacheable object');
        }
        const client = await this.get_client();
        const data_key = get_redis_key('DATA', cacheable.key);
        const info_key = get_redis_key('INFO', cacheable.key);
        const exp_key = get_redis_key('EXP', cacheable.key);
        const data_ttl = cacheable.data_ttl + cacheable.extra_ttl;
        const multi = client.multi();
        multi.psetex(data_key, data_ttl, cacheable.data_value);
        multi.hmset(info_key, ...cacheable.info_args);
        // to allow info_key to expire within cacheable.info_ttl
        if (cacheable.created_time === cacheable.timestamp) {
            multi.pexpire(info_key, cacheable.info_ttl);
        }
        if (cacheable.to_refresh) {
            const ttl = cacheable.data_ttl;
            const value = JSON.stringify({timestamp: Date.now, ttl});
            multi.psetex(exp_key, ttl, value);
        }
        const result = await multi.exec();
        if (cacheable.to_refresh) {
            if (result.length !== 4) return false;
            if (result[3][1] !== 'OK') return false;
        } else {
            if (result.length !== 3) return false;
        }
        if (result[0][1] !== 'OK') return false;
        if (result[1][1] !== 'OK') return false;
        if (result[2][1] !== 1) return false;
        if (cacheable.dependent_keys) {
            this.update_dependencies(client, cacheable, data_ttl);
        }
        return true;
    }

    async get_info(cacheable) {
        if (!cacheable.key) {
            throw new Error('get_info, no key in cacheable object');
        }
        const client = await this.get_client();
        const info_key = get_redis_key('INFO', cacheable.key);
        const result = await client.hgetall(info_key);
        if (!result || Object.keys(result).length === 0) return false;
        cacheable.info = result;
        client.pexpire(info_key, cacheable.info_ttl);
        return true;
    }

    async set_info(cacheable) {
        if (!cacheable.key || !cacheable.params) {
            throw new Error('set_info, no key or/and params in cacheable object');
        }
        const client = await this.get_client();
        const info_key = get_redis_key('INFO', cacheable.key);
        const multi = client.multi();
        multi.hmset(info_key, ...cacheable.info_args),
        multi.pexpire(info_key, cacheable.info_ttl);
        const result = await multi.exec();
        if (result.length !== 2) return false;
        if (result[0][1] !== 'OK') return false;
        if (result[1][1] !== 1) return false;
        return true;
    }

    async delete(cacheable, ignore_expire = false) {
        if (!cacheable.key) {
            throw new Error('delete, no key in cacheable object');
        }
        const client = await this.get_client();
        const data_key = get_redis_key('DATA', cacheable.key);
        const exp_key = get_redis_key('EXP', cacheable.key);
        const no_exp_key = 'NO-' + exp_key;
        const multi = client.multi();
        if (ignore_expire) {
            multi.psetex(no_exp_key, 3000, 1);
        }
        multi.del(data_key);
        multi.del(exp_key);
        const result = await multi.exec();
        if (ignore_expire) {
            if (result.length !== 3) return false;
            if (result[1][1] !== 1) return false;
        } else {
            if (result.length !== 2) return false;
            if (result[0][1] !== 1) return false;
        }
        return true;
    }

    async delete_all(cacheable) {
        if (!cacheable.key) {
            throw new Error('delete, no key in cacheable object');
        }
        const client = await this.get_client();
        const data_key = get_redis_key('DATA', cacheable.key);
        const info_key = get_redis_key('INFO', cacheable.key);
        const exp_key = get_redis_key('EXP', cacheable.key);
        const multi = client.multi();
        multi.del(data_key);
        multi.del(info_key);
        multi.del(exp_key);
        const result = await multi.exec();
        if (result.length !== 3) return false;
        if (result[0][1] !== 1) return false;
        if (result[1][1] !== 1) return false;
        return true;
    }

    async has_data(key) {
        const client = await this.get_client();
        const data_key = get_redis_key('DATA', key);
        const value = await client.exists(data_key);
        if (value) return true;
        else return false;
    }

    async get_dependencies(dependency_key) {
        const dep_key = get_redis_key('DEP', dependency_key);
        const client = await this.get_client();
        return await client.smembers(dep_key);
    }

    update_dependencies(client, cacheable, data_ttl) {
        const handle = setTimeout(async () => {
            for (const key of cacheable.dependent_keys) {
                const dep_key = get_redis_key('DEP', key);
                const multi = client.multi();
                multi.sadd(dep_key, cacheable.key);
                multi.pexpire(dep_key, data_ttl);
                const result = await multi.exec();
                // result[1][1] can be 0 or 1 if already exists it is 0
                if (result.length !== 2 || result[1][1] !== 1) {
                    console.error('update_dependencies, failed for', key, result);
                }
            }
            clearTimeout(handle);
        }, 100);
        handle.unref();
    }
}

module.exports = RedisCache;