'use strict';

const data_ignore_keys = [ 'id', 'key', 'handle', 'comment', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy' ];

module.exports = ({key, data = {}, ...rest}) => {
    if (!rest || Object.keys(rest).length === 0) return data;
    for (const [k, v] of Object.entries(rest)) {
        if (v === null || data_ignore_keys.includes(k)) continue;
        data[k] = v;
    }
    return data;
}