'use strict';

const get_config = require('../app/get-config');
const merge_filters = require('./merge-filters');
const get_config_key = require('./get-config-key');

module.exports = (params) => {
    
    let config_key;

    params.sort_default = !params.sort;
    
    if (params.handle) {
        
        const config = get_config(params.handle, true);

        if (config && config.params) {

            const config_params = config.params;
            const filters = params.filters;
            const config_filters = config_params.filters;

            Object.assign(params, config_params);
            
            if (filters || config_filters) {
                params.filters = merge_filters(filters, config_filters);
            }

            config_key = get_config_key(params.handle, true);
        }
    }

    if (params.fields && !params.fields.includes('id')) {
        params.fields.unshift('id');
    }

    return config_key;
}
