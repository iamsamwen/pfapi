'use strict';

const AppBase = require('./app-base');
const is_ip_matched = require('../utils/is-ip-matched');

class PfapiApp extends AppBase {

    constructor(strapi) {
        super(strapi);
    }

    is_white_listed(ctx) {
        const list = this.get_white_ip_list();
        if (list && list.length > 0) {
            return is_ip_matched(ctx, list);
        }
        return false;
    }

    is_blocked(ctx) {
        const list = this.get_black_ip_list();
        if (list && list.length > 0) {
            return is_ip_matched(ctx, list);
        }
        return false;
    } 

    is_auth(ctx, params) {
        const roles = this.get_permission_roles(params);
        if (!roles) return false; 
        const role = this.get_api_key_role(params);
        return roles.includes(role);
    }

}

module.exports = PfapiApp;
