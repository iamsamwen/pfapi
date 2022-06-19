'use strict';

const fp = require('lodash/fp');

module.exports = (filters, config_filters) => {
    
    filters = filters && Object.keys(filters).length > 0 ? filters : undefined;

    if (!filters) return get_filters_array(config_filters);
    if (!config_filters) return  get_filters_array(filters);

    filters = get_filters_array(filters);
    config_filters = get_filters_array(config_filters);

    for (const filter of config_filters) {
        if (filters.find(x => fp.isEqual(x, filter))) continue;
        filters.push(filter);
    }

    return filters
}

function get_filters_array(filters) {
    if (!filters) return undefined;
    if (filters.$and && Object.keys(filters).length === 1) {
        return filters.$and;
    } else if (!Array.isArray(filters)) {
        return [ filters ];
    }
    return filters;
}