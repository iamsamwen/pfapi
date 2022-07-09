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

    is_white_listed(ctx) {
        debug_verbose('is_white_listed ctx.state', ctx.state);
        if (ctx.state?.pfapi_white_listed !== undefined) {
            return ctx.state.pfapi_white_listed;
        }
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'white-list'
        if (ctx.state) ctx.state.pfapi_white_listed = result;
        else ctx.state = {pfapi_white_listed: result};
        debug('is_white_listed', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_white_listed list', logging.cmsg({list}));
        return result;
    }

    is_blocked(ctx) {
        debug_verbose('is_blocked ctx.state', ctx.state);
        if (ctx.state?.pfapi_black_listed !== undefined) {
            return ctx.state.pfapi_black_listed;
        }
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'black-list';
        if (ctx.state) ctx.state.pfapi_black_listed = result;
        else ctx.state = {pfapi_black_listed: result};
        debug('is_blocked', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_blocked list', logging.cmsg({list}))
        return result;
    } 

    is_throttled(ctx) {
        debug_verbose('is_throttle ctx.state', ctx.state);
        if (ctx.state?.pfapi_is_throttled !== undefined) {
            return ctx.state.pfapi_is_throttled;
        }
        const result = this.throttle?.is_throttled(ctx);
        if (ctx.state) ctx.state.pfapi_is_throttled = result;
        else ctx.state = {pfapi_is_throttled: result}
        debug('is_throttled', logging.cmsg({result, ip: get_ip(ctx), path: ctx.path}));
        debug_verbose('is_throttled throttles', logging.cmsg(this.throttle ? this.throttle.get_throttles(): 'throttle is not setup'));
        return result;
    }

    is_auth(ctx, params) {
        debug_verbose('is_auth ctx.state', ctx.state);
        if (ctx.state?.pfapi_is_auth !== undefined) {
            return ctx.state.pfapi_is_auth;
        }
        let result = false, api_key, role;
        const roles = this.get_permission_roles(params);
        if (roles) {
            [api_key, role] = this.get_api_key_role(params);
            result = roles.includes(role);
        }
        const state = {pfapi_is_auth: result, pfapi_role: role, pfapi_api_key: api_key};
        if (ctx.state) Object.assign(ctx.state, state);
        else ctx.state = state;
        debug('is_auth', logging.cmsg({result, role, api_key }));
        debug_verbose('is_auth roles', logging.cmsg({roles}))
        return result;
    }

}

module.exports = PfapiApp;
