'use strict';

const LocalCache = require('./models/local-cache');
const RedisCache = require('./models/redis-cache');
const HttpRequest = require('./models/http-request');
const HttpThrottle = require('./utils/http-throttle');
const Servers = require('./utils/servers');
const RefreshQueue = require('./utils/refresh-queue');
const ExpiresWatch = require('./utils/expires-watch');
const get_config_key = require('./lib/get-config-key');
const get_params = require('./lib/get-params');
const get_params_uid = require('./lib/get-params-uid');
const update_params_id = require('./lib/update-params-id');
const fetch_config = require('./lib/fetch-config');

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

    after_upsert(event) {
        const uid = event.model.uid;
        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            if (this.servers) this.servers.publish({uid, action: 'upsert', data: event.result});
        } else if (event.params.data.publishedAt === null) {
            if (this.servers) this.servers.publish({uid, action: 'delete', data: event.result});
        }
    }

    after_delete(event) {
        const uid = event.model.uid;
        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            if (this.servers) this.servers.publish({uid, action: 'delete', data: event.result});
        }
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

    get maintenance_interval() {
        if (this.config && this.config.maintenance_interval) return this.config.maintenance_interval;
        return 100000;
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
                (!this.update_at || now_ms - this.update_at.getTime() > config_update_interval)) {
                await this.update_configs();
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
}

module.exports = AppBase;