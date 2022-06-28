'use strict';

const get_dependency_key = require('./get-dependency-key');

module.exports = (name, is_handle) => {
    return get_dependency_key({uid: name, id: is_handle});
    
}