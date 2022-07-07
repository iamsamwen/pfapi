'use strict';

const debug = require('debug')('pfapi:app');
const debug_verbose = require('debug')('pfapi-verbose:app');
const logging =  require('./logging');

const AppBase = require('./app-base');
const ip_prefix_matched = require('../utils/ip-prefix-matched');

class PfapiApp extends AppBase {

    constructor(strapi) {
        super(strapi);
    }

    is_white_listed(ctx) {
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'white-list'
        debug('is_white_listed', logging.cmsg({result, ip: ctx.ip, path: ctx.path}));
        debug_verbose('is_white_listed list', logging.cmsg(list));
        return result;
    }

    is_blocked(ctx) {
        const list = this.get_ip_list();
        const status = ip_prefix_matched(ctx, list);
        const result = status === 'black-list'
        debug('is_blocked', logging.cmsg({result, ip: ctx.ip, path: ctx.path}));
        debug_verbose('is_blocked list', logging.cmsg(list))
        return result;
    } 

    is_throttled(ctx) {
        const result = this.throttle?.is_throttled(ctx);
        debug('is_throttled', logging.cmsg({result, ip: ctx.ip, path: ctx.path}));
        debug_verbose('is_throttled throttles', logging.cmsg(this.throttle ? this.throttle.get_throttles(): 'throttle is not setup'));
        return result;
    }

    is_auth(ctx, params) {
        let result = false, api_key, role;
        const roles = this.get_permission_roles(params);
        if (roles) {
            [api_key, role] = this.get_api_key_role(params);
            result = roles.includes(role);
        }
        debug('is_auth', logging.cmsg({result, role, api_key }));
        debug_verbose('iis_auth roles', logging.cmsg(roles))
        return result;
    }

}

module.exports = PfapiApp;
