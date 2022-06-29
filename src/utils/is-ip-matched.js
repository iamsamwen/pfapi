'use strict';

const { matches } = require('ip-matching');

module.exports = (ctx, ips_list) => {
    if (!ips_list || ips_list.length === 0) return false;
    const ip = ctx.request.ip;
    for (const list_ip of ips_list) {
        if (matches(ip, list_ip)) return true;
    }
    return false;
}