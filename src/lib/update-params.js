'use strict';

const get_config = require('./get-config');
const merge_filters = require('./merge-filters');

module.exports = (params) => {
    
    if (!params.name) return;

    const config = get_config(params.name);

    if (!config || Object.keys(config).length === 0) return;

    const filters = params.filters;
    const config_filters = config.filters;

    Object.assign(params, config);
    
    if (filters || config_filters) {
        params.filters = merge_filters(filters, config_filters);
    }
}