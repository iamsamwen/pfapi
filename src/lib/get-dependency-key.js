'use strict';

const get_checksum = require('./get-checksum');

// strapi specific 

/**
 * for aggregate operations like count, the result may change 
 * when some record data is changed, deleted or inserted
 * 
 * @param {*} param0 
 * @returns 
 */
module.exports = ({uid, id}) => {
    if (!uid) {
        console.error(`generate dependency key without uid`);
        return null;
    }
    const data = { uid };
    if (id) data.id = String(id);
    return get_checksum(data);
};