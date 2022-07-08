'use strict';

const { matches } = require('ip-matching');

module.exports = (ctx, list) => {
    if (!list || list.length === 0) return false;
    const request_ip = ctx.ip;
    const request_path = ctx.path;
    for (const { ip_cidr, prefix, status } of list) {
        if (prefix && !request_path.startsWith(prefix)) continue;
        if (ip_cidr && !matches(request_ip, ip_cidr)) continue;
        return status;
    }
    return false;
}
