'use strict';

const fp = require('lodash/fp');
const { v4: uuidv4 } = require('uuid');

const { HttpRequest, Cacheable, RedisCache, LocalCache, LocalInvalidate, RefreshQueue, EvictionWatch, get_class_config, get_cache_key } = require('../');

const EventPubSub = require('./event-pubsub');
const HttpThrottle = require('./http-throttle');

const ignore_keys = [ 'id', 'name', 'model', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy' ];

/**
 * a simple schema of pfapi config content-type:
 * 
 *   "attributes": {
 *     "name": {
 *       "type": "string",
 *       "required": true,
 *       "unique": true
 *     },
 *     "data": {
 *       "type": "json"
 *     }
 *   }
 */
class PfapiApp extends HttpRequest {

    constructor(config_uid) {
        super();
        this.config_uid = config_uid;
        this.config = this.get_default_config();
        this.uuid = uuidv4();
        this.run_maintenance_interval = 10000;
        this.instances = {};
    }

    get_default_config() {
        return {
            config_update_interval: 3600000,

            rate_limits: [
                { window_secs: 10, max_count: 1000, block_secs: 3600 },
            ],

            white_ips_list: [ '127.0.0.1' ],

            blocked_ips_list: [],

            proxy: true,
        }
    }

    get_params(ctx) {

        const params = fp.cloneDeep(ctx.query);
        
        for (const [key, value] of Object.entries(ctx.params)) {
            if (key === '0') continue;
            params[key] = value;
        }
        
        if (params.model) params.uid = `api::${params.model}.${params.model}`;
    
        params.has_sort = !!params.sort;

        return params;
    }

    is_blocked(ctx) {
        const ip = ctx.request.ip;
        for (const blocked_ip of this.config.blocked_ips_list) {
            if (ip.startsWith(blocked_ip)) return true;
        }
        return false;
    }

    is_throttled(ctx) {
        return this.throttle.is_throttled(ctx);
    }    

    is_auth(ctx, {api_key, model}) {
        if (this.config.api_keys) {
            if (!api_key) return false;
            const user_info = this.config.api_keys[api_key];
            if (user_info) {
                ctx.user_info = user_info;
                if (this.config.allowed_models) {
                    return this.config.allowed_models.includes(model);
                }
                return true;
            }
            return false;
        } else {
            return true;
        }
    }

    // for throttle
    //
    get_signature(ctx) {
        const ip = ctx.request.ip;
        for (const white_ip of this.config.white_ips_list) {
            if (ip.startsWith(white_ip)) return null;
        }
        return {ip};
    }

    setup_throttles() {
        this.throttle.reset();
        for (const {window_secs, max_count, block_secs} of this.config.rate_limits) {
            this.throttle.set_throttle(window_secs, max_count, block_secs);
        }
    }

    async on_receive(message, from) {
        //console.log('receive:', {message, from});
        switch(message.action) {
            case 'keep-alive':
                this.instances[from] = message.now_ms;
                break;
            case 'shutdown':
                delete this.instances[from];
                break;
            case 'upsert': {
                    const {model, data} = message;
                    if (data && model && this.config_uid.endsWith(`${model}.${model}`)) {
                        this.update_config(data);
                    } else {
                        console.log(`unknown message ${JSON.stringify(message)}`);
                    }
                }
                break;
            case 'delete': {
                const {model, data} = message;
                    if (model && this.config_uid.endsWith(`${model}.${model}`)) {
                        this.del_config(data.name);
                    } else {
                        console.log(`unknown message ${JSON.stringify(message)}`);
                    }
                }
                break;
            default:
                console.log(`unknown action ${message.action}`);
        }
    }

    async publish(message) {
        await this.pubsub.publish(message);
    }

    after_update(event, get_send_delete_data) {
        if (event.result.publishedAt) {
            const model = event.model.singularName;
            if (get_send_delete_data) {
                const data = get_send_delete_data(event);
                if (data) this.publish({model, action: 'delete', data});
            }
            this.publish({model, action: 'upsert', data: event.result});
        } else if (event.params.data.publishedAt === null) {
            const model = event.model.singularName;
            this.publish({model, action: 'delete', data: event.result});
        }
    }
    
    after_delete = (event) => {
        if (event.result.publishedAt) {
            const model = event.model.singularName;
            this.publish({model, action: 'delete', data: event.result});
        }
    }

    async start(strapi) {
        
        Object.assign(this, get_class_config(this, await this.fetch_config(this.constructor.name)));

        this.redis_cache = new RedisCache(process.env.REDIS_URI);
    
        this.local_cache = new LocalCache(this.redis_cache, await this.fetch_config('LocalCache'));
        
        await this.update_all_configs();

        if (this.config.proxy) {
            strapi.app.proxy = true;
        }
    
        this.pubsub = new EventPubSub(this, this.redis_cache, this.uuid);

        await this.pubsub.start();

        const now_ms = Date.now();
        
        await this.publish({action: 'keep-alive', now_ms});

        this.local_invalidate = new LocalInvalidate(this.redis_cache, this.local_cache);
        await this.local_invalidate.start();

        this.throttle = new HttpThrottle(this, this.redis_cache, this.local_cache);

        this.run_maintenance();

        global.PfapiApp = this;
        
        if (strapi) strapi.PfapiApp = this;
    }

    run_maintenance() {

        this.update_timer = setInterval(async () => {
            const now_ms = Date.now();
            await this.publish({action: 'keep-alive', now_ms});
            for (const [uuid, timestamp] of Object.entries(this.instances)) {
                if (now_ms - timestamp > 3 * this.run_maintenance_interval) delete this.instances[uuid];
            }
            if (this.is_master()) {
                if (!this.refresh_queue) {
                    console.log('start refresh queue', this.uuid);
                    this.refresh_queue = new RefreshQueue(this.redis_cache, this.local_cache);
                    await this.refresh_queue.start();
                    this.eviction_watch = new EvictionWatch(this.redis_cache, this.refresh_queue);
                    await this.eviction_watch.start();
                }
            } else {
                if (this.refresh_queue) {
                    console.log('stop  eviction watch and refresh queue', this.uuid)
                    await this.eviction_watch.stop();
                    this.eviction_watch = null;
                    await this.refresh_queue.stop();
                    this.refresh_queue = null;
                }
            }
            const { config_update_interval } = this.config;
            if (config_update_interval && (!this.update_at || now_ms - this.update_at.getTime() > config_update_interval)) {
                await this.update_all_configs();
            }
        }, this.run_maintenance_interval);

    }

    is_master() {
        const uuids = Object.keys(this.instances);
        if (uuids.length === 0) return false;
        return this.uuid === uuids.sort()[0];
    }

    async stop() {
        await this.publish({action: 'shutdown'});
        if (this.update_timer) {
            clearInterval(this.update_timer);
            this.update_timer = null;
        }
        if (this.pubsub) {
            await this.pubsub.stop();
        }
        if (this.local_invalidate) {
            await this.local_cache.stop();
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

    get_config_key(name) {
        return get_cache_key({params: {uid: this.config_uid, name}})
    }

    get_config(name) {
        if (!this.local_cache) {
            throw new Error('local_cache is not setup');
        }
        const key = this.get_config_key(name);
        return this.local_cache.get(key) || {};
    }

    del_config(name) {
        if (!this.local_cache) {
            throw new Error('local_cache is not setup');
        }
        if (!name) return false;
        const key = this.get_config_key(name);
        if (name === this.constructor.name) {
            this.config = this.get_default_config();
        }
        return this.local_cache.delete(key);
    }

    update_config(item) {
        if (!this.local_cache) {
            throw new Error('local_cache is not setup');
        }
        if (!item || !item.name) return false;
        const key = this.get_config_key(item.name);
        const data = this.merge_and_clean_data(item);
        const cacheable = new Cacheable({key, data, permanent: true});
        if (item.name === this.constructor.name) {
            this.config = data;
        }
        return this.local_cache.save(cacheable);
    }

    async update_all_configs() {

        const query = {where: {publishedAt: {$ne: null}}};
        if (this.update_at) {
            query.where.$or = [{createdAt: {$gt: this.update_at}}, {updatedAt: {$gt: this.update_at}}];
        } else this.update_at = new Date();;

        const items = await strapi.query(this.config_uid).findMany(query);
        for (const item of items) this.update_config(item);
    
    }

    async fetch_config(name) {
        const result = await strapi.query(this.config_uid).findOne({where: {name, publishedAt: {$ne: null}}}) || {};
        return this.merge_and_clean_data(result);
    }

    merge_and_clean_data({name, data = {}, ...rest}) {
        if (!rest) return data;
        for (const [k, v] of Object.entries(rest)) {
            if (v === null || ignore_keys.includes(k)) continue;
            data[k] = v;
        }
        return data;
    }
}

module.exports = PfapiApp;

