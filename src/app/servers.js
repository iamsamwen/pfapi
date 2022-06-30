'use strict';

const RedisPubsub = require('../lib/redis-pubsub');
const Cacheable = require('../lib/cacheable');
const get_dependency_key = require('../utils/get-dependency-key');
const lifecycles = require('./lifecycles');

class Servers extends RedisPubsub {

    constructor(app) {
        super(app.redis_cache);
        this.local_cache = app.local_cache;
        this.app = app;
        this.strapi = app.strapi;
        this.config_uid = app.config_uid;
        this.handle_uid = app.handle_uid;
        this.instances = [];
        this.subscribed_uids = [];
    }

    is_primary() {
        if (this.instances.length === 0) return false;
        return this.uuid === this.instances[0].uuid;
    }
    
    async on_receive(message, from) {
        if (process.env.DEBUG_PUBSUB) console.log('on_receive:', {message, from});
        switch(message.action) {
            case 'keep-alive':
                this.update_instances(message, from);
                break;
            case 'shutdown':
                this.remove_instance(from);
                break;
            case 'subscribe-db-event': 
                this.subscribe_lifecycle_events(message.uid, false);
                break;
            case 'evict-local-cache': 
                this.evict_local_cache(message, from)
                break;
            case 'upsert':
                await this.on_db_upsert(message);
                break;
            case 'delete': 
                await this.on_db_delete(message);
                break;
            default:
                console.log(`unknown action ${message.action}`);
        }
    }

    evict_local_cache({keys}, from) {
        if (from === this.uuid) return;
        if (!keys || keys.length === 0) return;
        for (const key of keys) this.local_cache.delete(key);
    }

    async on_db_upsert(message) {
        const {uid, data} = message;
        if (process.env.DEBUG_LIFECYCLES) console.log('on_db_upsert', {uid, data});
        if (uid && data) {
            if ([this.config_uid, this.handle_uid].includes(uid)) {
                this.app.update_config(data);
                await this.evict_dependent(uid, data.key || data.handle);
            } else if (data.id) {
                await this.evict_dependent(uid, data.id);
            }
        } else {
            console.error('unknown upsert message', JSON.stringify(message));
        }
    }

    async on_db_delete(message) {
        const {uid, data} = message;
        if (process.env.DEBUG_LIFECYCLES) console.log('on_db_delete', {uid, data});
        if (uid && data) {
            if ([this.config_uid, this.handle_uid].includes(uid)) {
                this.app.del_config(data.handle, this.handle_uid === uid);
                await this.evict_dependent(uid, data.key || data.handle);
            } else {
                await this.evict_dependent(uid, data.id);
            }
        } else {
            console.error('unknown delete message', JSON.stringify(message));
        }
    }

    update_instances(message, from) {
        if (!message.timestamp) return;
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

    remove_instance(uuid) {
        const index = this.instances.findIndex(x => x.uuid === uuid);
        if (index !== -1) this.instances.splice(index, 1);
    }

    async evict_dependent(uid, id) {
        const key = get_dependency_key({uid, id});
        const keys = await this.redis_cache.get_dependencies(key);
        if (process.env.DEBUG_DEPENDENTS) console.log('evict_dependent', key, {uid, id}, keys);
        if (keys.length === 0) return;
        for (const key of keys) {
            const cacheable = new Cacheable({key});
            await cacheable.del(this.local_cache, this.redis_cache);
        }
        this.publish({action: 'evict-local-cache', keys})
    }

    after_upsert(event) {
        const uid = event.model.uid;
        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            this.publish({uid, action: 'upsert', data: event.result});
        } else if (event.params.data.publishedAt === null) {
            this.publish({uid, action: 'delete', data: event.result});
        }
    }

    after_delete(event) {
        const uid = event.model.uid;
        if (!event.result.hasOwnProperty('publishedAt') || event.result.publishedAt) {
            this.publish({uid, action: 'delete', data: event.result});
        }
    }

    subscribe_lifecycle_events(uid, publish = true) {
        if (!uid) {
            console.log('failed to subscribe_lifecycle_events, invalid uid', {uid, publish});
            return;
        }
        if (this.subscribed_uids.includes(uid)) return;
        if (this.is_primary()) {
            const key = 'LifecycleEventsSubscription';
            const { uids } = this.app.get_config(key, false);
            if (!uids.includes(uid)) {
                uids.push(uid);
                const data = {data: {uids}};
                 this.strapi.db.query(this.config_uid).update({where: {key}, data});
            }
        }
        this.subscribed_uids.push(uid);
        if (publish) this.publish({uid, action: 'subscribe-db-event'});
        if (process.env.DEBUG_LIFECYCLES) {
            console.log('subscribe_lifecycle_events', uid);
        }
        this.strapi.db.lifecycles.subscribe(lifecycles(this, uid))
    }
}

module.exports = Servers;