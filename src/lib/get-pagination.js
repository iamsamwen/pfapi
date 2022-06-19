'use strict';

module.exports = ({start, limit, total}) => {

    const pagination = { total, pageSize: limit };

    if (start >= total) start = total;

    pagination.page = Math.ceil((start + 1) / limit);
    pagination.pageCount = Math.ceil(total / limit);

    return pagination;
}

