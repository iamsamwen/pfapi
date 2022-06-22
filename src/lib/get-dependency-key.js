'use strict';

const get_checksum = require('./get-checksum');

// strapi specific 

/**
 * the case without id is for aggregate operations like count, the result may change 
 * when some record data is changed, deleted or inserted
 * 
 * 
 * @param {*} param0 
 * @returns 
 */
module.exports = ({uid, id}) => {
    if (!uid) {
        throw new Error(`generate dependency key without uid`);
    }
    return get_checksum(uid  + '/' + (id ? String(id) : ''));
};