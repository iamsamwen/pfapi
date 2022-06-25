'use strict';

const AppBase = require('../../src/models/app-base');
const RedisCache = require('../../src/models/redis-cache');
const LocalCache = require('../../src/models/local-cache');

class SimplePfapiApp extends AppBase {

    constructor() {
        super();
        this._local_cache = new LocalCache;
        this._redis_cache = new RedisCache();
    }

    get local_cache() {
        return this._local_cache;
    }

    get redis_cache() {
        return this._redis_cache;
    }
}

module.exports = new SimplePfapiApp();