'use strict';

const { v4: uuidv4 } = require('uuid');
const get_class_config = require('../utils/get-class-config');

/**
 * redis pub sub with mechanism to exclude message from self
 */
class RedisPubsub {

    constructor(redis_cache, config = {}, uuid = uuidv4()) {
        if (!redis_cache) {
            throw new Error('missing required redis_cache');
        }
        this.redis_cache = redis_cache;
        Object.assign(this, get_class_config(this, config));
        this.uuid = uuid;
    }

    async start() {
        this.pubsub_client = await this.on_pubsub(this.channel_name, async (event) => {
            const json = JSON.parse(event);
            if (this.exclude_self && json.from === this.uuid) return;
            await this.on_receive(json.message, json.from);
        });
    }

    async publish(message) {
        const event = {from: this.uuid, message};
        const client = await this.redis_cache.get_client();
        return await client.publish(this.channel_name, JSON.stringify(event));
    }

    async on_receive(message, from) {
        console.log(message, from);
    }

    async stop() {
        if (!this.pubsub_client) return;
        await this.turnoff_pubsub(this.pubsub_client, this.channel_name);
        await this.redis_cache.close(this.pubsub_client);
        this.pubsub = null;
    }

    // support functions

    async on_pubsub(channel_name, on_event) {

        const subscribe_client = await this.redis_cache.get_client(async (new_client) => {
            try {
                const subscribe_result = await new_client.subscribe(channel_name);
                if (subscribe_result !== 1) {
                    console.error('on_pubsub, failed to subscribe');
                    await this.close(subscribe_client);
                    return;
                }
                const id = await this.redis_cache.get_client_id(new_client);
                new_client.on('message', async (channel, data) => {
                    const current_id = await this.redis_cache.get_client_id(new_client);
                    //console.log('on_pubsub', {current_id, id});
                    if (current_id !== id) {
                        await new_client.unsubscribe(channel);
                        return;
                    }
                    await on_event(data);
                });
            } catch(err) {
                console.error(err);
            }
        });

        return subscribe_client;
    }
    
    async turnoff_pubsub(subscribe_client, channel) {
        await subscribe_client.unsubscribe(channel);
    }
}

module.exports = RedisPubsub;