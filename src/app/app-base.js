'use strict';

const get_checksum = require('../utils/get-checksum');
const get_dependency_key = require('../utils/get-dependency-key');
const get_params = require('../utils/get-params');
const { transform_config } = require('./handle-config');
const uids_config = require('./uids-config');
const default_configs = require('./default-configs');
const cache_requests = require('./cache-requests');

const HttpResponse = require('../lib/http-response');
const LocalCache = require('../lib/local-cache');
const RedisCache = require('../lib/redis-cache');
const HttpRequest = require('../lib/http-request');
const PfapiUids = require('./pfapi-uids');
const HttpThrottle = require('./http-throttle');
const Servers = require('./servers');

class AppBase extends HttpRequest {
    
    constructor(strapi) {
        super();
        this.strapi = strapi;
        global.PfapiApp = this;
        this.config = this.get_app_config('AppBase');
    }

    get_app_config(name) {
        const config = this.strapi.plugin('pfapi').config(name);
        if (config) return config;
        return default_configs[name];
    }

    get_white_ip_list() {
        const lists = this.get_config(uids_config.ips_uid) || {}
        return lists.white_list;
    }

    get_black_ip_list() {
        const lists = this.get_config(uids_config.ips_uid) || {}
        return lists.black_list;
    }

    get_api_key_role(params) {
        const api_key = params.api_key || params['api-key'];
        if (api_key) {
            if (params.api_key) delete params.api_key;
            else delete params['api-key'];
        }
        if (!api_key) return 'Public';
        return this.get_config(uids_config.keys_uid, {key: api_key}) || 'Public';
    }

    get_permission_roles({id, uid}) {
        if (!uid || !this.strapi.contentTypes[uid]) return [];
        const action = `${uid}.${id ? 'findOne' : 'find'}`;
        const permissions = this.get_config(uids_config.permissions_uid);
        if (!permissions) return [];
        return permissions[action] || [];
    }

    get_handle_config(handle) {
        const config_key = this.get_config_key(uids_config.handle_uid, {handle});
        return this.local_cache.get(config_key);
    }

    get_config_key(uid, data) {
        if (uid === uids_config.keys_uid) {
            if (!data || !data.key) throw new Error(`missing key for ${uid}`);
            return get_dependency_key({uid, id: data.key});
        } else if (uid === uids_config.handle_uid) {
            if (!data || !data.handle) throw new Error(`missing handle for ${uid}`);
            return get_dependency_key({uid, id: data.handle});
        } else if ([uids_config.ips_uid, uids_config.permissions_uid, uids_config.rate_limits_uid].includes(uid)) {
            return get_dependency_key({uid});
        } else {
            throw new Error(`${uid} is not support for config`);
        }
    }

    get_config(uid, data) {
        const config_key = this.get_config_key(uid, data);
        return this.local_cache.get(config_key);
    }

    get_key_and_config(uid, data) {
        const config_key = this.get_config_key(uid, data);
        const result = this.local_cache.get(config_key);
        return [config_key, result]; 
    }

    del_config(uid, data) {
        if (uid === uids_config.keys_uid || uid === uids_config.handle_uid) {
            const config_key = this.get_config_key(uid, data);
            this.local_cache.delete(config_key);
        } else if (uid === uids_config.ips_uid) {
            this.pfapi_uids.load_ips();
        } else if (uid === uids_config.permissions_uid) {
            this.pfapi_uids.load_permissions();
        } else if (uid === uids_config.rate_limits_uid) {
            this.pfapi_uids.load_rate_limits();
        } else {
            throw new Error(`${uid} is not support for del_config`);
        }
    }

    update_config(uid, data) {
        if (uid === uids_config.keys_uid) {
            if (data.role) {
                const config_key = this.get_config_key(uid, data);
                const old_role = this.local_cache.get(config_key);
                if (old_role !== data.role.name) {
                    this.local_cache.put(config_key, data.role.name, true);
                }
            }
        } else if (uid === uids_config.handle_uid) {
            const config_key = this.get_config_key(uid, data);
            const {file_ids, config} = transform_config(data);
            const old_config = this.local_cache.get(config_key);
            const checksum = get_checksum(config);
            if (!old_config || checksum !== old_config.checksum) {
                config.checksum = checksum;
                config.modified_time = Date.now();
                config.timestamp = old_config?.timestamp || config.modified_time;
                this.update_file_dependency(file_ids, config_key);
                this.local_cache.put(config_key, config, true);
            }
        } else if (uid === uids_config.ips_uid) {
            this.pfapi_uids.load_ips();
        } else if (uid === uids_config.permissions_uid) {
            this.pfapi_uids.load_permissions();
        } else if (uid === uids_config.rate_limits_uid) {
            this.pfapi_uids.load_rate_limits();
        }
    }

    update_file_dependency(file_ids, config_key) {
        for (const id of file_ids) {
            const file_key = get_checksum({file_id: id});
            const config_keys = this.local_cache.get(file_key) || [];
            if (!config_keys.includes(config_key)) {
                config_keys.push(config_key);
                this.local_cache.put(file_key, config_keys, this.config.sync_interval || 3600000);
            }
        }
    }

    get_params(ctx) {
        const params = get_params(ctx);
        const { handle,  id } = params;
        const config = handle ? this.get_config(uids_config.handle_uid, { handle }) : null;
        if (config && config.uid) {
            params.uid = config.uid;
        } else if (handle) {
            const cache_key = get_checksum('uid_models');
            const models = this.local_cache.get(cache_key);
            params.uid = models[handle];
        }
        if (id) this.update_params_id(config, params, id);
        return params;
    }

    update_params_id(config, params, id) {
        const id_field = config && config.id_field ? config.id_field : 'id';
        if (params.filters) {
            if (params.filters.$and) params.filters.$and.push({[id_field]: id})
            else params.filters[id_field] = id;
        } else {
            params.filters = {[id_field]: id};
        }
    }

    subscribe_lifecycle_events(uid, publish = true) {
        this.servers.subscribe_lifecycle_events(uid, publish);
    }

    async handle_cache_requests(ctx) {
        if (!process.env.DEBUG || ['pfapi:cache', 'pfapi:*', '*'].includes(process.env.DEBUG) || ctx.ip !== '127.0.0.1') {
            this.http_response.handle_nocache_request(ctx, 403, {message: 'Forbidden! Only available for local cache debug'});
        } else {
            await cache_requests(ctx, this.http_response, this.local_cache, this.redis_cache);
        }
    }

    is_throttled(ctx) {
        return this.throttle.is_throttled(ctx);
    }

    async start() {

        this.http_response = new HttpResponse(this);

        this.local_cache = new LocalCache();

        this.redis_cache = new RedisCache(this.get_app_config('redis_uri'));

        this.strapi.PfapiApp = this;

        this.throttle = new HttpThrottle(this);

        this.pfapi_uids = new PfapiUids(this);    

        this.servers = new Servers(this);

        this.started_at = Date.now();

        await this.pfapi_uids.start(this.config.sync_interval || 3600000);

        await this.servers.start(this.started_at, this.config.maintenance_interval || 100000);

    }

    async stop() {

        if (this.servers) {
            await this.servers.publish({action: 'shutdown'});
        }

        if (this.pfapi_uids) {
            await this.pfapi_uids.stop();
        }
        if (this.local_invalidate) {
            await this.local_invalidate.stop();
        }
        if (this.throttle) {
            await this.throttle.stop();
        }

        this.local_cache.stop();

        setTimeout(async () => {
            if (this.servers) {
                await this.servers.stop();
            }
            await this.redis_cache.close();
        }, 100);

    }
}

module.exports = AppBase;