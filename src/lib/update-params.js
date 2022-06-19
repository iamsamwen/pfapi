'use strict';

const get_config = require('./get-config');
const merge_filters = require('./merge-filters');

module.exports = (params) => {
    if (params.name) {
        const config = get_config(params.name);
        if (config && Object.keys(config).length > 0) {
            Object.assign(params, config);
            if (params.filters || config.filters) {
                params.filters = merge_filters(params.filters, config.filters);
            }
        }
    }
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
            delete params[key];
        }
    }
}