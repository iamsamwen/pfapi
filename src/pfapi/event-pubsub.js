'use strict';

const { PubSub } = require('../');

class EventPubSub extends PubSub {

    constructor(app, redis_client, uuid) {
        super(redis_client, {}, uuid);
        this.app = app;
    }

    async on_receive(message, from) {
        await this.app.on_receive(message, from);
    }
}

module.exports = EventPubSub;