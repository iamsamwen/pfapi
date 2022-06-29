'use strict';

const Throttle = require('../lib/throttle');

class HttpThrottle extends Throttle {

    constructor(app) {
        super(app.redis_cache, app.local_cache);
        this.app = app;
        if (app.config.rate_limits) {
            this.apply_rate_limits(app.config.rate_limits);
        }
    }

    get_signature(ctx) {
        if (this.app.is_white_listed && this.app.is_white_listed(ctx)) {
            return null;
        }
        if (this.app.throttle_pattern) {
            return this.app.throttle_pattern(ctx);
        }
        return {ip: ctx.ip};
    }
}

module.exports = HttpThrottle;