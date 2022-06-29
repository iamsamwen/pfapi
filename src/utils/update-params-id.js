'use strict';

module.exports = (config, params, id) => {
    const id_field = config && config.id_field ? config.id_field : 'id';
    if (params.filters) {
        if (params.filters.$and) params.filters.$and.push({[id_field]: id})
        else params.filters[id_field] = id;
    } else {
        params.filters = {[id_field]: id};
    }
}