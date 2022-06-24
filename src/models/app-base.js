'use strict';

const default_configs = require('../lib/default-configs');
const HttpRequest = require('./http-request');

class AppBase extends HttpRequest {
    
    constructor() {
        super();
    }

    get_config(name) {
        return default_configs[name];
    }

    get local_cache() {
        throw new Error('get local_cache not implemented yet!');
    }

    get redis_cache() {
        throw new Error('get redis_cache not implemented yet!');
    }
    
    start() {
        global.PfapiApp = this;
    }
}

module.exports = AppBase;