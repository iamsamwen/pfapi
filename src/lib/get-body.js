'use strict';

module.exports = (data) => {
    if (data === undefined || data === null) return '';
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    return JSON.stringify(data);
};