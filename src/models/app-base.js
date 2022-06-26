'use strict';

const HttpRequest = require('./http-request');
const get_cache_key = require('../lib/get-cache-key');

class AppBase extends HttpRequest {
    
    constructor() {
        super();
        global.PfapiApp = this;
    }

    get_config(name, is_handle) {
        if (!this._local_cache) return null;
        const key = get_cache_key({params: {key: name, is_handle}})
        return this._local_cache.get(key);
    }

    subscribe_lifecycle_events(uid) {
        console.log(`subscribe_lifecycle_events(${uid}) not implemented`);
    }
}

module.exports = AppBase;