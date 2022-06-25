'use strict';

const HttpRequest = require('./http-request');

class AppBase extends HttpRequest {
    
    constructor() {
        super();
        global.PfapiApp = this;
    }

    get_config(name) {
        return null;
    }

    get local_cache() {
        throw new Error('get local_cache not implemented yet!');
    }

    get redis_cache() {
        throw new Error('get redis_cache not implemented yet!');
    }
}

module.exports = AppBase;