'use strict';

const HttpRequest = require('./http-request');
const get_config_key = require('../lib/get-config-key');

class AppBase extends HttpRequest {
    
    constructor() {
        super();
        global.PfapiApp = this;
    }

    get_config(name, is_handle) {
        const local_cache = this.local_cache;
        if (!local_cache) return null;
        const key = get_config_key(name, is_handle)
        return local_cache.get(key);
    }

    subscribe_lifecycle_events(uid) {
        console.log(`subscribe_lifecycle_events(${uid}) not implemented`);
    }
}

module.exports = AppBase;