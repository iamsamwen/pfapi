'use strict';

const fp = require('lodash/fp');

const LocalCache = require('../lib/local-cache');
const RedisCache = require('../lib/redis-cache');
const HttpRequest = require('../lib/http-request');
const RefreshQueue = require('../lib/refresh-queue');
const ExpiresWatch = require('../lib/expires-watch');

const get_dependency_key = require('../utils/get-dependency-key');
const get_params = require('../utils/get-params');
const normalize_data = require('../utils/normalize-data');
const default_configs = require('../utils/default-configs');

const HttpThrottle = require('./http-throttle');
const Servers = require('./servers');

class AppBase extends HttpRequest {
    
    constructor(strapi, config, config_uid, handle_uid) {
        super();
        this.strapi = strapi;
        this.config = config;
        this.config_uid = config_uid;
        this.handle_uid = handle_uid;
        global.PfapiApp = this;
    }

    get_config_key(key, is_handle) {
        const uid = is_handle ? this.handle_uid : this.config_uid;
        return get_dependency_key({uid, id: key})
    }

    get_config(key, is_handle) {
        const config_key = this.get_config_key(key, is_handle);
        return this.local_cache.get(config_key);
    }

    del_config(key, is_handle) {
        if (!key) return false;
        this.local_cache.delete(config_key);
        if (key === this.constructor.name) {
            this.config = default_config;
            this.apply_config();
        } else if (is_handle) {
            const uid = is_handle ? this.handle_uid : this.config_uid;
        }
    }

    update_config(item) {
        if (!item || (!item.handle && !item.key)) return false;
        const config_key = this.get_config_key(item.handle || item.key, !!item.handle);
        const data = normalize_data(item);
        const old_data = this.local_cache.get(config_key);
        if (fp.isEqual(data, old_data)) return true;
        this.local_cache.put(config_key, data, true);
        this.apply_config(item, data);
        return true;
    }

    apply_config({key}, data) {
        if (key === this.constructor.name) {
            this.strapi.app.proxy = !!data.proxy;
            this.throttle.apply_rate_limits(data.rate_limits);
        }
    }

    async fetch_config(key) {
        const result = await this.strapi.db.query(this.config_uid).findOne({where: { key }}) || {};
        return normalize_data(result);
    }

    get_params(ctx) {
        const params = get_params(ctx);
        const { handle,  id} = params;
        const config = handle ? this.get_config(handle, true) : null;
        params.uid = this.get_params_uid(config, handle);
        if (id) this.update_params_id(config, params, id);
        return params;
    }

    get_params_uid(config, handle) {
        if (config && config.uid) {
            return config.uid;
        } else if (handle) {
            const cache_key = `api_uid::${handle}`;
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
            const type = ctx.params.type;
            const key = ctx.params.key;
            if (type == 'local' && this.local_cache) {
                if (key === 'list') {
                    const data = this.local_cache.list(ctx.query);
                    this.http_response.handle_nocache_request(ctx, 200, data);
                } else {
                    const data = this.local_cache.get_with_info(key);
                    if (data) this.http_response.handle_nocache_request(ctx, 200, data);
                    else this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
                }
            } else if (type === 'redis' && this.redis_cache) {
                if (key === 'list') {
                    const data = await this.redis_cache.list(ctx.query);
                    this.http_response.handle_nocache_request(ctx, 200, data);
                } else if (key === 'deps') {
                    const data = await this.redis_cache.deps(ctx.query);
                    this.http_response.handle_nocache_request(ctx, 200, data);
                } else {
                    const data = await this.redis_cache.get(key);
                    if (data) this.http_response.handle_nocache_request(ctx, 200, data);
                    else this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
                }
            } else {
                this.http_response.handle_nocache_request(ctx, 404, {message: 'Not Found'});
            }
        }
    }

    get maintenance_interval() {
        return this.config.maintenance_interval || 100000;
    }

    async start() {

        Object.assign(this.config, await this.fetch_config(this.constructor.name));
    
        this.local_cache = new LocalCache(await this.fetch_config('LocalCache'));

        this.redis_cache = new RedisCache(process.env.REDIS_URI);

        this.throttle = new HttpThrottle(this);
    
        if (this.strapi) this.strapi.PfapiApp = this;

        this.servers = new Servers(this);
        await this.servers.start();

        this.subscribe_lifecycle_events(this.config_uid, false);
        this.subscribe_lifecycle_events(this.handle_uid, false);
        
        if (this.update_configs) await this.update_configs();

        this.setup_lifecycle_events_subscription();

        this.started_at = Date.now();;

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

            const { config_update_interval } = this.config;
            if (this.update_configs && config_update_interval && 
                (!this.update_configs_at_ms || now_ms - this.update_configs_at_ms > config_update_interval)) {
                await this.update_configs();
                this.update_configs_at_ms = now_ms;
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

    setup_lifecycle_events_subscription() {
        const { uids } = this.get_config('LifecycleEventsSubscription', false) || {};
        if (uids && uids.length > 0) {
            for (const uid of uids) {
                if (!this.strapi.contentTypes[uid]) continue;
                this.subscribe_lifecycle_events(uid, false);
            }
        }
    }

    async update_configs() {

        const items1 = await this.strapi.db.query(this.config_uid).findMany();

        if (items1.length > 0) {
            for (const item of items1) this.update_config(item);
        } else {
            const entries = [];
            for (const [key, data] of Object.entries(default_configs)) {
                entries.push({key, data});
            }
            if (entries.length > 0) {
                await this.strapi.db.query(this.config_uid).createMany({data: entries});
            }
            if (this.initialize_data) await this.initialize_data();
        }

        const items2 = await this.strapi.db.query(this.handle_uid).findMany();
        if (items2.length > 0) {
            for (const item of items2) this.update_config(item);
        }
    }

}

module.exports = AppBase;