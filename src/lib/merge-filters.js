'use strict';

const fp = require('lodash/fp');

module.exports = (filters, config_filters) => {

    filters = filters && Object.keys(filters).length > 0 ? filters : undefined;

    if (!filters) {
        if (!config_filters || Object.keys(config_filters).length === 0) return undefined;
        filters = get_array(config_filters);
        return get_object(filters);
    }

    if (!config_filters || Object.keys(config_filters).length === 0) {
        filters = get_array(filters);
        return get_object(filters);
    }

    filters = get_array(filters);
    config_filters = get_array(config_filters);

    for (const filter of config_filters) {
        if (filters.find(x => fp.isEqual(x, filter))) continue;
        filters.push(filter);
    }

    return get_object(filters);
}

function get_object(filters) {
    if (!filters) return undefined;
    if (filters.length === 1) return filters[0];
    return {$and: filters};
}

function get_array(filters) {
    if (!filters) return undefined;
    if (filters.$and && Object.keys(filters).length === 1) {
        return filters.$and;
    } else if (!Array.isArray(filters)) {
        return [ filters ];
    }
    return filters;
}