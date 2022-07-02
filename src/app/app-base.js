'use strict';

//const util = require('util');
const fp = require('lodash/fp');

const get_checksum = require('../utils/get-checksum');
const get_dependency_key = require('../utils/get-dependency-key');
const get_params = require('../utils/get-params');
const normalize_config = require('./normalize-config');
const fetch_config = require('./fetch-config');
const uids_config = require('./uids-config');
const default_configs = require('./default-configs');
const cache_request = require('./cache-request');

const LocalCache = require('../lib/local-cache');
const RedisCache = require('../lib/redis-cache');
const HttpRequest = require('../lib/http-request');
const RefreshQueue = require('../lib/refresh-queue');
const ExpiresWatch = require('../lib/expires-watch');
const PfapiUids = require('./pfapi-uids');
const HttpThrottle = require('./http-throttle');
const Servers = require('./servers');

class AppBase extends HttpRequest {
    
    constructor(strapi, config) {
        super();

        this.strapi = strapi;
        this.config = config;
        global.PfapiApp = this;
    }

    get_white_ip_list() {
        const { white_list } = this.get_config(uids_config.ips_uid) || []
        return white_list;
    }

    get_black_ip_list() {
        const { black_list } = this.get_config(uids_config.ips_uid) || []
        return black_list;
    }

    get_api_key_role({api_key}) {
        if (!api_key) return 'Public';
        return this.get_config(uids_config.keys_uid, {key: api_key}) || 'Public';
    }

    get_permission_roles({id, uid}) {
        if (!uid) return [];
        const action = `${uid}.${id ? 'findOne' : 'find'}`;
        const permissions = this.get_config(uids_config.permissions_uid);
        if (!permissions) return [];
        return permissions[action] || [];
    }

    get_config_key(uid, data) {
        if (uid === uids_config.config_uid || uid === uids_config.keys_uid) {
            if (!data || !data.key) throw new Error(`missing key for ${uid}`);
            return get_dependency_key({uid, id: data.key})
        } else if (uid === uids_config.handle_uid) {
            if (!data || !data.handle) throw new Error(`missing handle for ${uid}`);
            return get_dependency_key({uid, id: data.handle})
        } else if ([uids_config.ips_uid, uids_config.permissions_uid, uids_config.rate_limits_uid].includes(uid)) {
            return get_dependency_key({uid, id: ''})
        } else {
            throw new Error(`${uid} is not support for config`)
        }
    }

    get_config(uid, data) {
        const config_key = this.get_config_key(uid, data);
        const result = this.local_cache.get(config_key);
        if (result) return result; 
        if (uid !== uids_config.config_uid && !data.key) {
            return null;
        }
        return default_configs[data.key];
    }

    get_key_and_config(uid, data) {
        const config_key = this.get_config_key(uid, data);
        const result = this.local_cache.get(config_key);
        if (result) return [config_key, result]; 
        if (uid !== uids_config.config_uid && !data.key) {
            return [config_key, null];
        }
        return [config_key, default_configs[data.key]];
    }

    del_config(uid, data) {
        if ([uids_config.config_uid, uids_config.keys_uid, uids_config.handle_uid].includes(uid)) {
            const config_key = this.get_config_key(uid, data);
            this.local_cache.delete(config_key);
            if (uid === uids_config.config_uid) {
                if (data.key === 'PfapiApp') {
                    const default_data = default_configs[data.key];
                    this.strapi.app.proxy = !!default_data.proxy;
                    this.config.config_sync_interval = default_data.config_sync_interval;
                } else if (data.key === 'LocalCache') {
                    this.local_cache.config = default_configs[data.key];
                } else if (data.key === 'RedisPubsub') {
                    this.servers.config = default_configs[data.key];
                } else if (data.key === 'RefreshQueue') {
                    if (this.refresh_queue) {
                        this.refresh_queue.config = default_configs[data.key];
                    }
                } else if (data.key === 'HttpResponse') {
                    this.http_response.config = default_configs[data.key];
                }
            }
        } else if (uid === uids_config.ips_uid) {
            this.pfapi_uids.load_ips();
        } else if (uid === uids_config.permissions_uid) {
            this.pfapi_uids.load_permissions();
        } else if (uid === uids_config.rate_limits_uid) {
            this.pfapi_uids.load_rate_limits();
        }
    }

    update_config(uid, data) {
        if ([uids_config.config_uid, uids_config.keys_uid, uids_config.handle_uid].includes(uid)) {
            const config_key = this.get_config_key(uid, data);
            let changed = false;
            if (uid === uids_config.config_uid || uid === uids_config.handle_uid) {
                data = normalize_config(data);
                const old_data = this.local_cache.get(config_key);
                if (!fp.isEqual(data, old_data)) {
                    changed= true;
                    this.local_cache.put(config_key, data, true);
                }
            } else if (data.role) {
                const old_role = this.local_cache.get(config_key);
                if (old_role !== data.role.name) {
                    changed = true;
                    this.local_cache.put(config_key, data.role.name, true);
                }
            }
            if (changed && uid === uids_config.config_uid) {
                if (data.key === 'PfapiApp') {
                    this.strapi.app.proxy = !!data.proxy;
                    this.config.config_sync_interval = data.config_sync_interval;
                } else if (data.key === 'LocalCache') {
                    Object.assign(this.local_cache.config, data);
                } else if (data.key === 'RedisPubsub') {
                    Object.assign(this.servers.config, data);
                } else if (data.key === 'RefreshQueue') {
                    if (this.refresh_queue) {
                        Object.assign(this.refresh_queue.config, data);
                    }
                } else if (data.key === 'HttpResponse') {
                    Object.assign(this.http_response.config, data);
                }
            }
        } else if (uid === uids_config.ips_uid) {
            this.pfapi_uids.load_ips();
        } else if (uid === uids_config.permissions_uid) {
            this.pfapi_uids.load_permissions();
        } else if (uid === uids_config.rate_limits_uid) {
            this.pfapi_uids.load_rate_limits();
        }
    }

    get_params(ctx) {
        const params = get_params(ctx);
        const { handle,  id} = params;
        const config = handle ? this.get_config(uids_config.handle_uid, { handle }) : null;
        params.uid = this.get_params_uid(config, handle);
        if (id) this.update_params_id(config, params, id);
        ctx.state.pfapi = { config }
        return params;
    }

    get_params_uid(config, handle) {
        if (config && config.uid) {
            return config.uid;
        } else if (handle) {
            const cache_key = get_checksum({api_handle_uid: handle});
            let uid = this.local_cache.get(cache_key);
            if (uid) {
                return uid;     
            } else {
                for (const [key, value] of Object.entries(this.strapi.contentTypes)) {
                    if (!key.startsWith('api::')) continue;
                    const {info: {pluralName}} = value;
                    if (handle === pluralName) {
                        uid = key;
                        this.local_cache.put(cache_key, uid);
                        break;
                    }
                }
                return uid;
            }
        }
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

    async start_refresh_queue() {
        if (this.refresh_queue) await this.refresh_queue.stop();
        this.refresh_queue = new RefreshQueue(this.redis_cache, this.local_cache);
        await this.refresh_queue.start();
        if (this.expires_watch) await this.expires_watch.stop();
        this.expires_watch = new ExpiresWatch(this.redis_cache, this.refresh_queue);
        await this.expires_watch.start();
        console.log('expires watch/refresh started', this.servers.uuid);
    }

    async stop_refresh_queue() {
        if (this.expires_watch) await this.expires_watch.stop();
        this.expires_watch = null;
        if (this.refresh_queue) await this.refresh_queue.stop();
        this.refresh_queue = null;
        console.log('expires watch/refresh stopped', this.servers.uuid);
    }

    async handle_cache_request(ctx) {
        if (!process.env.DEBUG) {
            this.http_response.handle_nocache_request(ctx, 403, {message: 'Forbidden! Only available for DEBUG'});
        } else {
            await cache_request(ctx, this.http_response, this.local_cache, this.redis_cache);
        }
    }

    get maintenance_interval() {
        return this.config.maintenance_interval || 100000;
    }

    async start() {

        this.config = await fetch_config(this.strapi, 'PfapiApp') || this.config;
    
        this.local_cache = new LocalCache(await fetch_config(this.strapi, 'LocalCache'));

        this.redis_cache = new RedisCache(process.env.REDIS_URI);

        this.pfapi_uids = new PfapiUids(this);

        this.throttle = new HttpThrottle(this);
    
        if (this.strapi) this.strapi.PfapiApp = this;

        this.servers = new Servers(this);

        await this.servers.start();

        await this.setup_lifecycle_events_subscription();

        await this.pfapi_uids.load_all();
        
        this.synced_at_ms = this.started_at = Date.now();

        this.servers.publish({action: 'keep-alive', timestamp: this.started_at, now_ms: this.started_at});

        this.update_timer = setInterval(async () => {

            const now_ms = Date.now();

            await this.servers.publish({action: 'keep-alive', timestamp: this.started_at, now_ms});

            const instances = this.servers.instances;

            for (let i = 0; i < instances; i++) {
                const { timestamp } = this.instances[i];
                if (now_ms - timestamp > 3 * this.maintenance_interval) {
                    instances.splice(i, 1);
                }
            }

            if (now_ms - this.started_at > this.maintenance_interval * 3) {
                if (this.servers.is_primary()) {
                    if (!this.refresh_queue) await this.start_refresh_queue()
                } else {
                    if (this.refresh_queue) await this.stop_refresh_queue();
                }
            }

            const { config_sync_interval } = this.config;
            if (config_sync_interval && (!this.synced_at_ms || now_ms - this.synced_at_ms > config_sync_interval)) {
                await this.load_all(now_ms);
                this.synced_at_ms = Date.now();
            }

        }, this.maintenance_interval);

    }

    async stop() {

        if (!this.servers) {
            console.error('failed to stop AppBase, servers is not ready');
            return;
        }

        await this.servers.publish({action: 'shutdown'});

        if (this.update_timer) {
            clearInterval(this.update_timer);
            this.update_timer = null;
        }
        if (this.servers) {
            await this.servers.stop();
        }
        if (this.local_invalidate) {
            await this.local_invalidate.stop();
        }
        if (this.refresh_queue) {
            await this.refresh_queue.stop();
        }
        if (this.throttle) {
            await this.throttle.stop();
        }
        this.local_cache.stop();
        await this.redis_cache.close();

    }

    async setup_lifecycle_events_subscription() {

        const uids = Object.values(uids_config);

        for (const uid of uids) {
            if (uid === uids_config.state_uid || uid === uids_config.roles_uid) continue;
            this.subscribe_lifecycle_events(uid, false);
        }

        const { lifecycle_uids } = await this.strapi.db.query(uids_config.state_uid).findOne() || {};
 
        if (lifecycle_uids && lifecycle_uids.length > 0) {
            for (const uid of lifecycle_uids) {
                if (!this.strapi.contentTypes[uid]) continue;
                this.subscribe_lifecycle_events(uid, false);
            }
        }
    }
}

module.exports = AppBase;