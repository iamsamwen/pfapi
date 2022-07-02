'use strict';

const ignore_keys = [ 'comment', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy' ];

module.exports = ({data, ...rest}) => {
    if (!data) data = {};
    else if (Array.isArray(data)) {
        const items = data;
        data = {};
        for (const {name, value} of items) {
            if (!name) continue;
            data[name] = value;
        }
    }
    if (!rest || Object.keys(rest).length === 0) return data;
    if (rest.attributes && Array.isArray(rest.attributes)) {
        const items = rest.attributes;
        rest.attributes = {};
        for (const {name, value} of items) {
            if (!name) continue;
            rest.attributes[name] = value;
        }
    }
    for (const [k, v] of Object.entries(rest)) {
        if (v === null || ignore_keys.includes(k)) continue;
        data[k] = v;
    }
    return data;
}