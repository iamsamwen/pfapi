'use strict';


const chai = require('chai');
const LocalCache = require('../../src/models/local-cache');
const RedisCache = require('../../src/models/redis-cache');
const Throttle = require('../../src/utils/throttle');
const sleep = require('../helpers/sleep');

const expect = chai.expect;

// NODE_ENV=test mocha --timeout 30000 --reporter spec tests/utils/test-throttle

describe('test throttle', () => {

    it('simple', async () => {

        const redis_cache = new RedisCache();
        const local_cache = new LocalCache();

        await redis_cache.flushall();
        local_cache.clear();
        
        const throttle = new Throttle(redis_cache, local_cache);

        throttle.set_throttle(1, 3, 1);

        expect(throttle.is_throttled('target')).is.false;
        expect(throttle.is_throttled('target')).is.false;
        expect(throttle.is_throttled('target')).is.false;

        for (let i = 0; i < 10; i++) {
            console.log('check is_throttled true', i);
            await sleep(200);
            if (throttle.is_throttled('target')) break;
        }
        
        expect(throttle.is_throttled('target')).is.true;
        
        for (let i = 0; i < 10; i++) {
            console.log('check is_throttled false', i);
            await sleep(1000);
            if (!throttle.is_throttled('target')) break;
        }

        expect(throttle.is_throttled('target')).is.false;

        throttle.stop();
        local_cache.stop();
        await redis_cache.close();
    });

});