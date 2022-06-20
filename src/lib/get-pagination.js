'use strict';

const get_start_limit = require('./get-start-limit');

module.exports = (input = {}) => {

    let [start, limit] = get_start_limit(input);
    
    let total = input.total;
    if (isNaN(total)) total = 0;
    if (typeof total !== 'number') total = Number(total);
    if (total < 0) total = 0;
    if (start > total) start = total;

    const pagination = { total, pageSize: limit };

    pagination.page = Math.ceil((start + 1) / limit);
    pagination.pageCount = Math.ceil(total / limit);

    return pagination;
}

