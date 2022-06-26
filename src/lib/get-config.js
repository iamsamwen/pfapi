'use strict';

const default_configs = require('./default-configs');

module.exports = (name, is_class = false) => {
    if (global.PfapiApp) {
        const result = global.PfapiApp.get_config(name, is_class);
        if (result) return result;
        if (!is_class) return null;
    }
    return default_configs[name];
}