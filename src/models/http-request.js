'use strict';

const Refreshable = require('./refreshable');
const Composite = require('./composite');
const HttpResponse = require('./http-response');
const refreshable_request = require('../lib/refreshable-request');
const composite_request = require('../lib/composite-request');

class HttpRequest {

    constructor() {
        this.http_response = new HttpResponse();
    }

    /**
     * 
     * @param {*} ctx 
     * @param {*} object Refreshable or Composite
     */
    async handle(ctx, object) {

        const start_time = process.hrtime.bigint();

        if (this.is_blocked(ctx)) {

            this.http_response.handle_simple_request(ctx, 403, {message: 'Forbidden'});

        } else if (this.is_throttled(ctx)) {

            this.http_response.handle_simple_request(ctx, 429, {message: 'Too Many Requests'});

        } else {

            const params = this.get_params(ctx);

            if (!this.is_auth(ctx, params)) {

                this.http_response.handle_simple_request(ctx, 429, {message: 'Unauthorized'});

            } else if (object instanceof Refreshable) {

                await refreshable_request(ctx, params, object, this);

            } else if (object instanceof Composite) {

                await composite_request(ctx, params, object, this);

            } else {

                this.http_response.handle_simple_request(ctx, 500, {message: 'unknown object type'});

            }
        }
        
        const end_time = process.hrtime.bigint();
        const ms = (Number(end_time - start_time) / 1000000).toFixed(2);

        ctx.set('X-Response-Time', `${ms} ms`);
    }

    get local_cache() {
        return null;
    }

    get redis_cache() {
        return null;
    }

    get_params(ctx) {
        return ctx.query;
    }

    is_blocked(ctx) {
        return false;
    }

    is_throttled(ctx) {
        return false;
    }

    is_auth(ctx, params) {
        return true;
    }

}

module.exports = HttpRequest;