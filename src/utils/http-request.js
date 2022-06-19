'use strict';

const Refreshable = require('../lib/refreshable');
const Composite = require('../lib/composite');
const HttpResponse = require('./http-response');
const refreshable_request = require('./refreshable-request');
const composite_request = require('./composite-request');

class HttpRequest {

    constructor() {
        this.http_response = new HttpResponse();
    }

    /**
     * 
     * @param {*} ctx 
     * @param {*} object Refreshable or Composite
     */
    async handle_request(ctx, object) {

        if (this.is_blocked(ctx)) {
            this.http_response.handle_simple_request(ctx, 403, {message: 'Forbidden'});
            return;
        }

        if (this.is_throttled(ctx)) {
            this.http_response.handle_simple_request(ctx, 429, {message: 'Too Many Requests'});
            return;
        }
    
        const params = this.get_params(ctx);

        if (!this.is_auth(ctx, params)) {
            this.http_response.handle_simple_request(ctx, 429, {message: 'Unauthorized'});
            return;
        }

        if (object instanceof Refreshable) {

            return await refreshable_request(ctx, params, object);

        } else if (object instanceof Composite) {

            return await composite_request(ctx, params, object);

        } else {

            throw new Error(`unknown object type: ${object.constructor.name}`);
        }
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