'use strict';

const { matches } = require('ip-matching');

module.exports = (ctx, list) => {
    if (!list || list.length === 0) return false;
    const request_ip = ctx.ip;
    const request_path = ctx.path;
    for (const { ip, prefix, status } of list) {
        if (prefix && !request_path.startsWith(prefix)) continue;
        if (ip && !matches(request_ip, ip)) continue;
        return status;
    }
    return false;
}
