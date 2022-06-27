'use strict';

const get_config_key = require('./get-config-key');

module.exports = ({key, handle} = {}) => {
    if (key) return get_config_key(key, false);
    if (handle) return get_config_key(handle, true);
    return null;
}