'use strict';

const Throttle = require('./throttle');
const is_ip_matched = require('../lib/is-ip-matched');

class HttpThrottle extends Throttle {

    constructor(app) {
        super(app.redis_cache, app.local_cache);
        this.app = app;
        if (app.config.rate_limits) {
            this.apply_rate_limits(app.config.rate_limits);
        }
    }

    get_signature(ctx) {
        if (this.app.config.white_ips_list) {
            const white_ips_list = this.app.config.white_ips_list;
            if (is_ip_matched(ctx, white_ips_list)) {
                return null;
            }
        }
        return {ip};
    }

    subscribe_lifecycle_events(uid, publish = true) {
        if (this.servers) this.servers.subscribe_lifecycle_events(uid, publish);
    }
}

module.exports = HttpThrottle;