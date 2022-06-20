'use strict';

module.exports = ({start, limit, page, pageSize} = {}) => {

    if (limit === undefined || limit === null) {
        limit = pageSize;
    }
    if (isNaN(limit)) limit = 20;
    if (typeof limit !== 'number') limit = Number(limit);
    if (limit <= 0) limit = 20;
    else if (limit > 100) limit = 100;

    if (start === undefined || start === null) {
        if (page) start = (Number(page) - 1) * limit;
    }
    if (isNaN(start)) start = 0;
    if (typeof start !== 'number') start = Number(start);
    if (start < 0) start = 0;

    return [start, limit];
}