'use strict';

const default_configs = require('../lib/default-configs');

module.exports = (name, is_handle = true) => {
    if (global.PfapiApp) {
        const result = global.PfapiApp.get_config(name, is_handle);
        if (result) return result;
    }
    if (is_handle) {
        return null;
    }
    return default_configs[name];
}