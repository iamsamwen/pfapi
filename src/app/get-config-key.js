'use strict';

module.exports = (name, is_handle) => {
    if (global.PfapiApp) {
        return global.PfapiApp.get_config_key(name, is_handle);
    }
    return null;
}