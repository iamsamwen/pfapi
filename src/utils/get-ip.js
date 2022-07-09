'use strict';

const { getClientIp } = require('request-ip');

module.exports = (ctx) => {
    if (ctx.state?.pfapi_ip) return ctx.state.pfapi_ip;
    const ip = ctx.req ? getClientIp(ctx.req) : ctx.ip;
    if (ctx.state) ctx.state.pfapi_ip = ip;
    else ctx.state = {pfapi_ip: ip};
    return ip;
}