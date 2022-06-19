'use strict';

const get_checksum = require('./get-checksum');

module.exports = ({db, cn, id}) => {
    if (!cn || !id) {
        console.error(`generate dependency key without cn or id`);
        return null;
    }
    return get_checksum({db, cn, id});
};