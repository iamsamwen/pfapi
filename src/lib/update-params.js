'use strict';

const get_config = require('./get-config');
const merge_filters = require('./merge-filters');

module.exports = (params) => {
    
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
        }
    }

    if (params.fields && !params.fields.includes('id')) {
        params.fields.unshift('id');
    }
}
