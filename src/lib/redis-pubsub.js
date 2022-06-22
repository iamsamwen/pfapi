'use strict';

const { v4: uuidv4 } = require('uuid');
const get_class_config = require('../lib/get-class-config');

/**
 * redis pub sub with mechanism to exclude message from self
 */
class RedisPubsub {

    constructor(redis, config = {}, uuid = uuidv4()) {
        if (!redis) {
            throw new Error('missing required redis');
        }
        this.redis = redis;
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
        const client = await this.redis.get_client();
        return await client.publish(this.channel_name, JSON.stringify(event));
    }

    async on_receive(message, from) {
        console.log(message, from);
    }

    async stop() {
        if (!this.pubsub_client) return;
        await this.turnoff_pubsub(this.pubsub_client, this.channel_name);
        await this.redis.close(this.pubsub_client);
        this.pubsub = null;
    }

    // support functions

    async on_pubsub(channel_name, on_event) {
        const subscribe_client = await this.redis.get_client(true);
        const subscribe_result = await subscribe_client.subscribe(channel_name);
        if (subscribe_result !== 1) {
            console.error('on_pubsub, failed to subscribe');
            await this.close(subscribe_client);
            return [];
        }
        subscribe_client.on('message', async (channel, data) => {
            //console.log({channel, data})
            await on_event(data);
        });
        return subscribe_client;
    }
    
    async turnoff_pubsub(subscribe_client, channel) {
        await subscribe_client.unsubscribe(channel);
    }
}

module.exports = RedisPubsub;