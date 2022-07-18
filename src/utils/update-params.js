'use strict';

const get_key_and_config = require('../app/get-key-and-config');
const merge_filters = require('./merge-filters');
const uids_config = require('../app/uids-config');

module.exports = (params) => {

    params.sort_default = !params.sort;
    
    if (params.fields && !params.fields.includes('id')) {
        params.fields.unshift('id');
    }

    if (params.handle) {
        
        const [config_key, config] = get_key_and_config(uids_config.handle_uid, params);

        if (config && config.params) {

            const config_params = config.params;
            const filters = config_params.merge_filters !== false ? params.filters : undefined;
            const config_filters = config_params.filters;

            Object.assign(params, config_params);
            
            params.filters = merge_filters(filters, config_filters);
        }
    
        return config_key;
    }

}
