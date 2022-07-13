'use strict';

const debug = require('debug')('pfapi:app');
const debug_verbose = require('debug')('pfapi-verbose:app');
const logging =  require('./logging');

const AppBase = require('./app-base');
const ip_prefix_matched = require('../utils/ip-prefix-matched');
const get_ip = require('../utils/get-ip');

class PfapiApp extends AppBase {

    constructor(strapi) {
        super(strapi);
    }

    is_unlimited(ctx) {
        debug_verbose('is_unlimited ctx.state', ctx.state);
        if (!ctx.state.pfapi) ctx.state.pfapi = {};
        else if (ctx.state.pfapi.unlimited !== undefined) {
            return ctx.state.pfapi.unlimited;
        }
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'unlimited'
        ctx.state.pfapi.unlimited = result;
        debug('is_unlimited', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_unlimited list', logging.cmsg({list}));
        return result;
    }

    is_blocked(ctx) {
        debug_verbose('is_blocked ctx.state', ctx.state);
        if (!ctx.state.pfapi) ctx.state.pfapi = {};
        else if (ctx.state.pfapi.blocked !== undefined) {
            return ctx.state.pfapi.blocked;
        }
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'blocked';
        ctx.state.pfapi.blocked = result;
        debug('is_blocked', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_blocked list', logging.cmsg({list}))
        return result;
    } 

    is_throttled(ctx) {
        debug_verbose('is_throttle ctx.state', ctx.state);
        if (!ctx.state.pfapi) ctx.state.pfapi = {};
        else if (ctx.state.pfapi.throttled !== undefined) {
            return ctx.state.pfapi.throttled;
        }
        const result = this.throttle?.is_throttled(ctx);
        ctx.state.pfapi.throttled = result;
        debug('is_throttled', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_throttled throttles', logging.cmsg(this.throttle ? this.throttle.get_throttles(): 'throttle is not setup'));
        return result;
    }

    is_auth(ctx, params) {
        debug_verbose('is_auth ctx.state', ctx.state);
        if (!ctx.state.pfapi) ctx.state.pfapi = {};
        else if (ctx.state.pfapi.is_auth !== undefined) {
            return ctx.state.pfapi.is_auth;
        }
        let result = false, api_key, role;
        const roles = this.get_permission_roles(params);
        if (roles) {
            [api_key, role] = this.get_api_key_role(params);
            result = roles.includes(role);
        }
        const pfapi = {is_auth: result, role, api_key};
        Object.assign(ctx.state.pfapi, pfapi);
        debug('is_auth', logging.cmsg(pfapi));
        debug_verbose('is_auth roles', logging.cmsg({roles}))
        return result;
    }

}

module.exports = PfapiApp;
