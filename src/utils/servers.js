'use strict';

const RedisPubsub = require('../lib/redis-pubsub');
const Cacheable = require('../models/cacheable');
const get_dependency_key = require('../lib/get-dependency-key');
const lifecycles = require('../lib/lifecycles');

class Servers extends RedisPubsub {

    constructor(app) {
        super(app.redis_cache);
        this.local_cache = app.local_cache;
        this.app = app;
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
        if (process.env.DEBUG > '2') console.log('on_receive:', {message, from});
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
        if (from === this.uuid || !this.app.local_cache) return;
        if (!keys || keys.length === 0) return;
        for (const key of keys) this.app.local_cache.delete(key);
    }

    async on_db_upsert(message) {
        const {uid, data} = message;
        if (process.env.DEBUG > '2') console.log('on_db_upsert', {uid, data});
        if (uid && data) {
            if ([this.config_uid, this.handle_uid].includes(uid)) {
                this.app.update_config(data);
            } else if (data.id) {
                await this.evict_dependent(uid, data.id);
            }
        } else {
            console.error('unknown upsert message', JSON.stringify(message));
        }
    }

    async on_db_delete(message) {
        const {uid, data} = message;
        if (process.env.DEBUG > '2') console.log('on_db_delete', {uid, data});
        if (uid && data) {
            if ([this.config_uid, this.handle_uid].includes(uid)) {
                this.app.del_config(data.name, this.handle_uid === uid);
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
        if (process.env.DEBUG > '1') console.log('evict_dependent', key, {uid, id}, keys);
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
        if (!this.app.strapi) return;
        if (!uid || this.subscribed_uids.includes(uid)) return;
        this.subscribed_uids.push(uid);
        if (publish) this.publish({uid, action: 'subscribe-db-event'});
        if (process.env.DEBUG > '1') console.log('subscribe_lifecycle_events', uid);
        this.app.strapi.db.lifecycles.subscribe(lifecycles(this, uid))
    }
}

module.exports = Servers;