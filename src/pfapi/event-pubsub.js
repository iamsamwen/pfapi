'use strict';

const { PubSub } = require('../');

class EventPubSub extends PubSub {

    constructor(app, redis_client, uuid) {
        super(redis_client, {channel_name: 'EVENT-PUBSUB::CHANNEL', exclude_self: false}, uuid);
        this.app = app;
    }

    async on_receive(message, from) {
        await this.app.on_receive(message, from);
    }
}

module.exports = EventPubSub;