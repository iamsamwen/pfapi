'use strict';

const default_configs = require('./default-configs');

module.exports = (name) => {
    if (global.PfapiApp) {
        const result = global.PfapiApp.get_config(name);
        if (result) return result;
    }
    return default_configs[name];
}