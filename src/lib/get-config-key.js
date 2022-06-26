'use strict';

const get_cache_key = require('./get-cache-key');

module.exports = (name, is_class) {
    return get_cache_key({params: {name, is_class}});
}