'use strict';

const { Throttle } = require('../');

class HttpThrottle extends Throttle {

    constructor(app, redis_cache, local_cache) {
        super(redis_cache, local_cache);
        this.app = app;
    }

    get_signature(target) {
        return this.app.get_signature(target);
    }
}

module.exports = HttpThrottle;