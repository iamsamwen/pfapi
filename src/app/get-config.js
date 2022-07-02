'use strict';

const default_configs = require('./default-configs');
const uids_config = require('./uids-config');

module.exports = (uid, data = {}) => {
    if (!uid.startsWith('plugin::')) {
        data = {key: uid};
        uid = uids_config.config_uid;
    }
    if (global.PfapiApp) {
        return global.PfapiApp.get_config(uid, data);
    }
    if (uid !== uids_config.config_uid && !data.key) {
        return null;
    }
    return default_configs[data.key];
}