'use strict';

const default_configs = require('./default-configs');
const Netmask = require('netmask').Netmask;

const Throttle = require('../lib/throttle');

class HttpThrottle extends Throttle {

    constructor(app) {
        super(app.redis_cache, app.local_cache);
        this.app = app;
        const rate_limits = default_configs['RateLimit'];
        if (rate_limits) this.apply_rate_limits(rate_limits);
    }

    /**
     *
     * @param {*} rate_limits 
     */
    apply_rate_limits(rate_limits) {
        this.reset();
        for (const rate_limit of rate_limits) {
            this.add_throttle(rate_limit);
        }
    }

    get_signature(ctx, params) {
        if (this.app.is_white_listed && this.app.is_white_listed(ctx)) {
            return null;
        }
        const {ip_mask, prefix} = params;
        if (prefix) {
            if (!ctx.path.startsWith(prefix)) return false;
        }
        try {
            const mask = new Netmask(ctx.ip, ip_mask);
            const base = mask.base;
            return {base, prefix};
        } catch(err) {
            console.error(err);
            return false;
        }
    }
}

module.exports = HttpThrottle;