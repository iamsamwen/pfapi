'use strict';

const { RedisPubsub } = require('../');

class EventPubSub extends RedisPubsub {

    constructor(app, redis_client, uuid) {
        super(redis_client, {}, uuid);
        this.app = app;
    }

    async on_receive(message, from) {
        await this.app.on_receive(message, from);
    }
}

module.exports = EventPubSub;