'use strict';

const get_config = require('./get-config');
const get_class_names = require('./get-class-names');

module.exports = (instance, config = {}) => {
    const class_names = get_class_names(instance);
    const result = {};
    for (const key of class_names) {
        const default_config = get_config(key, false);
        if (!default_config) continue;
        Object.assign(result, default_config);
    }
    Object.assign(result, config);
    return result;
};