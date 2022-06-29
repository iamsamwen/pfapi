'use strict';

const fp = require('lodash/fp');

const LocalCache = require('../lib/local-cache');
const RedisCache = require('../lib/redis-cache');
const HttpRequest = require('../lib/http-request');
const RefreshQueue = require('../lib/refresh-queue');
const ExpiresWatch = require('../lib/expires-watch');

const get_config_key = require('../utils/get-config-key');
const get_item_config_key = require('../utils/get-item-config-key');
const get_params = require('../utils/get-params');
const get_params_uid = require('../utils/get-params-uid');
const update_params_id = require('../utils/update-params-id');
const normalize_data = require('../utils/normalize-data');
const fetch_config = require('./fetch-config');
const default_configs = require('../utils/default-configs');

const HttpThrottle = require('./http-throttle');
const Servers = require('./servers');

class AppBase extends HttpRequest {
    
    constructor(config_uid, handle_uid) {
        super();
        global.PfapiApp = this;
        this.config_uid = config_uid;
        this.handle_uid = handle_uid;
    }

    get_config(name, is_handle) {
        const local_cache = this.local_cache;
        if (!local_cache) return null;
        const key = get_config_key(name, is_handle)
        return local_cache.get(key);
    }

    del_config(key, is_handle) {
        if (!this.local_cache || !key) return false;
        const config_key = get_config_key(key, is_handle);
        this.local_cache.delete(config_key);
        if (key === this.constructor.name) {
            this.config = default_config;
            this.apply_config();
        } else if (is_handle) {
            this.servers.evict_dependent(key, true);
        }
    }

    update_config(item) {
        if (!this.local_cache || !item) return false;
        const key = get_item_config_key(item);
        if (!key) return false;
        const data = normalize_data(item);
        const old_data = this.local_cache.get(key);
        if (fp.isEqual(data, old_data)) return true;
        this.local_cache.put(key, data, true);
        this.apply_config(item, data);
        return true;
    }

    apply_config({key, handle}, data) {
        if (key === this.constructor.name) {
            this.strapi.app.proxy = !!data.proxy;
            this.throttle.apply_rate_limits(data.rate_limits);
        } else if (handle) {
            this.servers.evict_dependent(handle, true);
        }
    }

    get_params(ctx) {
        const params = get_params(ctx);
        const { handle,  id} = params;
        const config = handle ? this.get_config(handle, true) : null;
        if (this.strapi && this.local_cache) {
            params.uid = get_params_uid(this.strapi, this.local_cache, config, handle);
        }
        if (id) update_params_id(config, params, id);
        return params;
    }

    subscribe_lifecycle_events(uid, publish = true) {
        if (this.servers) this.servers.subscribe_lifecycle_events(uid, publish);
    }

    async start_refresh_queue() {
        if (!this.redis_cache || !this.local_cache) return;
        if (this.refresh_queue) await this.refresh_queue.stop();
        this.refresh_queue = new RefreshQueue(this.redis_cache, this.local_cache);
        await this.refresh_queue.start();
        if (this.expires_watch) await this.expires_watch.stop();
        this.expires_watch = new ExpiresWatch(this.redis_cache, this.refresh_queue);
        await this.expires_watch.start();
        console.log('expires watch/refresh started', this.servers.uuid);
    }

    async stop_refresh_queue() {
        if (!this.redis_cache || !this.local_cache) return;
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

        Object.assign(this.config, await fetch_config(this, this.constructor.name));
    
        this.local_cache = new LocalCache(await fetch_config(this, 'LocalCache'));
        this.redis_cache = new RedisCache(process.env.REDIS_URI);

        this.throttle = new HttpThrottle(this);
    
        this.servers = new Servers(this);
        await this.servers.start();

        if (this.strapi) this.strapi.PfapiApp = this;

        this.subscribe_lifecycle_events(this.config_uid, false);
        this.subscribe_lifecycle_events(this.handle_uid, false);
        
        if (this.update_configs) await this.update_configs();

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

    async initialize_data() {
        const entries = [];
        for (const [key, data] of Object.entries(default_configs)) {
            entries.push({key, data});
        }
        if (entries.length > 0) {
            await this.strapi.query(config_uid).createMany({data: entries});
        }
    }
}

module.exports = AppBase;