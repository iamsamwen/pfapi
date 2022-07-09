'use strict';

const { getClientIp } = require('request-ip');

module.exports = (ctx) => {
    if (ctx.state?.pfapi_ip) return ctx.state.pfapi_ip;
    let ip;
    if (ctx.req) ip = getClientIp(ctx.req);
    if (!ip) ip = ctx.ip;
    if (ctx.state) ctx.state.pfapi_ip = ip;
    else ctx.state = {pfapi_ip: ip};
    return ip;
}