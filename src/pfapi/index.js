'use strict';

const fp = require('lodash/fp');
const { v4: uuidv4 } = require('uuid');

const { HttpRequest, Cacheable, RedisCache, LocalCache, 
    RefreshQueue, ExpiresWatch, get_class_config, 
    get_cache_key, default_configs, get_dependency_key } = require('../');

const EventPubSub = require('./event-pubsub');
const HttpThrottle = require('./http-throttle');

const config_ignore_keys = [ 'id', 'name', 'model', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy' ];

class PfapiApp extends HttpRequest {

    constructor(strapi, config_uid) {

        super();

        if (!strapi) {
            throw new Error('PfapiApp, missing argument strapi.');
        }
        if (!config_uid) {
            console.warn('PfapiApp, missing argument config_uid.');
        }

        this.strapi = strapi;
        if (config_uid) this.config_uid = config_uid;
        this.config = this.get_default_config();
        this.uuid = uuidv4();
        this.run_maintenance_interval = 10000;
        this.instances = [];
        this.subscribe_db_uids = [];
    }

    get_default_config() {
        return {
            config_update_interval: 3600000,

            rate_limits: [
                { window_secs: 10, max_count: 1000, block_secs: 3600 },
            ],

            white_ips_list: [ '127.0.0.1' ],

            blocked_ips_list: [],

            proxy: true
        }
    }

    get_params(ctx) {

        const params = fp.cloneDeep(ctx.query);
        
        for (const [key, value] of Object.entries(ctx.params)) {
            if (key === '0') continue;
            params[key] = value;
        }
        
        if (!params.uid && params.model) params.uid = `api::${params.model}.${params.model}`;
        if (params.id) params.id = Number(params.id);
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

    is_auth(ctx, {api_key, uid}) {
        if (this.config.api_keys) {
            if (!api_key) return false;
            const api_info = this.config.api_keys[api_key];
            if (api_info) {
                if (this.config.allowed_uids) {
                    return this.config.allowed_uids.includes(uid);
                }
                return true;
            }
            return false;
        } else {
            if (this.config.allowed_uids) {
                return this.config.allowed_uids.includes(uid);
            }
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
                this. update_instances(message, from);
                break;
            case 'shutdown':
                const index = this.instances.findIndex(x => x.uuid === from);
                if (index !== -1) this.instances.splice(index, 1);
                break;
            case 'subscribe-db-event': 
                if (from !== this.uuid && message.uid) {
                    this.subscribe_db_events(message.uid, false);
                }
                break;
            case 'evict-local-cache': 
                if (from !== this.uuid && message.keys) {
                    for (const key of message.keys) this.local_cache.delete({key});
                }
                break;
            case 'upsert':
                await this.upsert_db(message);
                break;
            case 'delete': 
                await this.delete_db(message);
                break;
            default:
                console.log(`unknown action ${message.action}`);
        }
    }

    async upsert_db(message) {

        const {uid, data} = message;

        if (uid && data) {
            if (uid === this.config_uid) {
                this.update_config(data);
            } else if (data.id) {
                await this.evict_dependent(uid, data.id);
            }
        } else {
            console.error('unknown upsert message', JSON.stringify(message));
        }
    }

    async delete_db(message) {

        const {uid, data} = message;

        if (uid && data) {
            if (uid === this.config_uid) {
                this.del_config(data.name);
            } else {
                await this.evict_dependent(uid, data.id);
            }
        } else {
            console.error('unknown delete message', JSON.stringify(message));
        }
    }

    update_instances(message, from) {

        let instance = {uuid: from, timestamp: message.timestamp};

        if (this.instances.length > 0) {
            if (this.instances.find(x => x.uuid === from)) {
                instance = null;
            } else {
                for (let i = 0; i < this.instances.length; i++) {
                    const { uuid, timestamp } = this.instances[i];
                    if (instance.timestamp < timestamp) {
                        this.instances.splice(i, 0, instance);
                        instance = null;
                    } else if (instance.timestamp === timestamp && from > uuid) {
                        this.instances.splice(i, 0, instance);
                        instance = null;
                    }
                }
            }
        }

        if (instance) this.instances.push(instance);
    }

    async publish(message) {
        await this.pubsub.publish(message);
    }

    async start() {
        
        Object.assign(this, get_class_config(this, await this.fetch_config(this.constructor.name)));
    
        this.local_cache = new LocalCache(await this.fetch_config('LocalCache'));

        this.redis_cache = new RedisCache(process.env.REDIS_URI);

        global.PfapiApp = this;

        await this.update_all_configs();

        if (this.config.proxy) {
            this.strapi.app.proxy = true;
        }
    
        this.pubsub = new EventPubSub(this, this.redis_cache, this.uuid);

        await this.pubsub.start();

        const now_ms = Date.now();
        
        await this.publish({action: 'keep-alive', now_ms});

        this.throttle = new HttpThrottle(this, this.redis_cache, this.local_cache);

        this.run_maintenance();

        this.strapi.PfapiApp = this;

        if (this.config_uid) this.subscribe_db_events(this.config_uid, false);
    }

    async evict_dependent(uid, id) {

        const key = get_dependency_key({uid, id});
        const keys = await this.redis_cache.get_dependencies(key);

        if (keys.length === 0) return;

        for (const key of keys) {
            const cacheable = new Cacheable({key});
            await cacheable.del(this.local_cache, this.redis_cache);
        }
        this.publish({action: 'evict-local-cache', keys})
    }

    after_upsert(event) {

        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            const uid = event.model.uid;
            this.publish({uid, action: 'upsert', data: event.result});
        } else if (event.params.data.publishedAt === null) {
            const uid = event.model.uid;
            this.publish({uid, action: 'delete', data: event.result});
        }
    }

    after_delete(event) {

        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            const uid = event.model.uid;
            this.publish({uid, action: 'delete', data: event.result});
        }
    }

    subscribe_db_events(uid, publish = true) {

        if (this.subscribe_db_uids.includes(uid)) return;
        
        this.subscribe_db_uids.push(uid);

        if (publish) this.publish({uid, action: 'subscribe-db-event'});

        console.log('subscribe_db_events', uid);

        this.strapi.db.lifecycles.subscribe({

            models: [uid],
        
            afterCreate(event) {
                strapi.PfapiApp.after_upsert(event);
            },
            afterUpdate(event) {
                strapi.PfapiApp.after_upsert(event);
            },
            afterDelete(event) {
                strapi.PfapiApp.after_delete(event);
            },
        })
    }

    run_maintenance() {

        this.started_at = Date.now();;

        this.update_timer = setInterval(async () => {

            const now_ms = Date.now();

            await this.publish({action: 'keep-alive', timestamp: this.started_at, now_ms});

            for (let i = 0; i < this.instances.length; i++) {
                const { timestamp } = this.instances[i];
                if (now_ms - timestamp > 3 * this.run_maintenance_interval) {
                    this.instances.splice(i, 1);
                }
            }

            if (now_ms - this.started_at > this.run_maintenance_interval * 3) {
                if (this.is_master()) {
                    if (!this.refresh_queue) await this.start_refresh_queue()
                } else {
                    if (this.refresh_queue) await this.stop_refresh_queue();
                }
            }

            const { config_update_interval } = this.config;
            if (config_update_interval && (!this.update_at || now_ms - this.update_at.getTime() > config_update_interval)) {
                await this.update_all_configs();
            }

        }, this.run_maintenance_interval);

    }

    async start_refresh_queue() {

        console.log('start expires watch and refresh queue', this.uuid);

        this.refresh_queue = new RefreshQueue(this.redis_cache, this.local_cache);
        await this.refresh_queue.start();
        this.expires_watch = new ExpiresWatch(this.redis_cache, this.refresh_queue);
        await this.expires_watch.start();
    }

    async stop_refresh_queue() {

        console.log('stop expires watch and refresh queue', this.uuid)

        await this.expires_watch.stop();
        this.expires_watch = null;
        await this.refresh_queue.stop();
        this.refresh_queue = null;
    }

    is_master() {
        if (this.instances.length === 0) return false;
        return this.uuid === this.instances[0].uuid;
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
        const data = this.normalize_config_data(item);
        const cacheable = new Cacheable({key, data, permanent: true});
        if (item.name === this.constructor.name) {
            this.config = data;
        }

        return this.local_cache.save(cacheable);
    }

    async update_all_configs() {

        if (!this.config_uid) return;

        const query = {where: {publishedAt: {$ne: null}}};
        if (this.updated_at) {
            query.where.$or = [{createdAt: {$gt: this.updated_at}}, {updatedAt: {$gt: this.updated_at}}];
        }

        const now = new Date();

        const items = await this.strapi.query(this.config_uid).findMany(query);
        for (const item of items) this.update_config(item);

        if (!this.updated_at) {
            if (items.length === 0) {
                const entries = [];
                for (const [name, data] of Object.entries(default_configs)) {
                    entries.push({name, data, publishedAt: now});
                }
                if (entries.length > 0) {
                    await this.strapi.query(this.config_uid).createMany({data: entries});
                }
                this.updated_at = new Date();
            } else {
                this.updated_at = now;
            }
        }
    
    }

    async fetch_config(name) {

        if (!this.config_uid) return {};

        const result = await this.strapi.query(this.config_uid).findOne({
            where: {name, publishedAt: {$ne: null}}
        }) || {};

        return this.normalize_config_data(result);
    }

    normalize_config_data({name, data = {}, ...rest}) {

        if (!rest || Object.keys(rest).length === 0) return data;
        for (const [k, v] of Object.entries(rest)) {
            if (v === null || config_ignore_keys.includes(k)) continue;
            data[k] = v;
        }
        return data;
    }
}

module.exports = PfapiApp;

