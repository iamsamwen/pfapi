'use strict';

const { getClientIp } = require('request-ip');

module.exports = (ctx) => {
    if (ctx.state?.pfapi?.ip) return ctx.state.pfapi.ip;
    let ip;
    if (ctx.req) ip = getClientIp(ctx.req);
    if (!ip) ip = ctx.ip;
    if (!ctx.state) ctx.state = {pfapi: {}};
    if (!ctx.state.pfapi) ctx.state.pfapi = {};
    ctx.state.pfapi.ip = ip;
    return ip;
}