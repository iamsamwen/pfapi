'use strict';

const AppBase = require('../../src/app-base');
const RedisCache = require('../../src/models/redis-cache');
const LocalCache = require('../../src/models/local-cache');

class SimplePfapiApp extends AppBase {

    constructor() {
        super();
        this.local_cache = new LocalCache;
        this.redis_cache = new RedisCache();
    }
}

module.exports = new SimplePfapiApp();