'use strict';

module.exports = ({start, limit, total}) => {

    if (isNaN(start)) start = 0;
    if (typeof start !== 'number') start = Number(start);
    if (isNaN(limit)) limit = 20;
    if (typeof limit !== 'number') limit = Number(limit);
    if (limit === 0) limit = 20;
    
    const pagination = { total, pageSize: limit };

    if (start >= total) start = total;

    pagination.page = Math.ceil((start + 1) / limit);
    pagination.pageCount = Math.ceil(total / limit);

    return pagination;
}

