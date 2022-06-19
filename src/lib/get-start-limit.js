'use strict';

module.exports = ({start, limit, page, pageSize}) => {

    if (limit) limit = Number(limit);
    else if (pageSize) {
        limit = Number(pageSize);
    }
    if (isNaN(limit) || limit === 0) limit = 20;
    else if (limit > 100) limit = 100;

    if (start !== undefined && start !== null) start = Number(start);
    else {
        if (page) start = (Number(page) - 1) * limit;
    }
    if (isNaN(start) || start < 0) start = 0;

    return [start, limit];
}