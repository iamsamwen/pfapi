'use strict';

const chai = require('chai');

const Cacheable = require('../../src/models/cacheable');
const refreshable = require('../helpers/simple-refreshable');
const LocalCache = require('../../src/models/local-cache');
const RedisCache = require('../../src/models/redis-cache');

const sleep = require('../helpers/sleep');

const expect = chai.expect;

// NODE_ENV=test mocha --timeout 30000 --reporter spec tests/models/test-cacheable-2

describe('Test cacheable-2', () => {
   
    it('get with local cache only', async () => {

        const local_cache = new LocalCache();
        
        const delay_ms = 10;

        const cacheable = new Cacheable({params: {delay_ms}, refreshable});

        const result1 = await cacheable.get(local_cache);

        expect(result1).equals(true);

        //console.log(cacheable);
        expect(result1).equals(true);
        expect(cacheable.from).equals('fetch');

        const result2 = await cacheable.get(local_cache);

        expect(result2).equals(true);
        expect(cacheable.from).equals('local');

        await local_cache.stop();
    });

    it('get with redis cache only', async () => {

        const redis_cache = new RedisCache();
        
        await redis_cache.flushall();

        const delay_ms = 10;

        const cacheable = new Cacheable({params: {delay_ms}, refreshable});

        const result1 = await cacheable.get(undefined, redis_cache);

        expect(result1).equals(true);

        //console.log(cacheable);
        expect(result1).equals(true);
        expect(cacheable.from).equals('fetch');

        await sleep(200);

        const result2 = await cacheable.get(undefined, redis_cache);

        //console.log(cacheable);
        expect(result2).equals(true);
        expect(cacheable.from).equals('redis');

        await redis_cache.close();
    });

    it('get with local cache and redis cache', async () => {

        const local_cache = new LocalCache({default_ttl: 50});

        const redis_cache = new RedisCache();
        
        await redis_cache.flushall();

        const delay_ms = 10;

        const cacheable = new Cacheable({params: {delay_ms}, refreshable});

        const result1 = await cacheable.get(local_cache, redis_cache);

        expect(result1).equals(true);

        //console.log(cacheable);
        expect(result1).equals(true);
        expect(cacheable.from).equals('fetch');

        const result2 = await cacheable.get(local_cache, redis_cache);

        //console.log(cacheable);
        expect(result2).equals(true);
        expect(cacheable.from).equals('local');

        await sleep(50);

        const result3 = await cacheable.get(local_cache, redis_cache);

        //console.log(cacheable);
        expect(result3).equals(true);
        expect(cacheable.from).equals('redis');

        await local_cache.stop();
        await redis_cache.close();
    });

});