'use strict';

const default_configs = require('./default-configs');

module.exports = (name) => {
    if (global.PfapiApp) {
        return global.PfapiApp.get_config(name);
    } else {
        return default_configs[name];
    }
}