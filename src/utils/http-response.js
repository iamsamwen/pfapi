'use strict';

const get_class_config = require('../lib/get-class-config');
const get_body = require('../lib/get-body');
const { get_etag, parse_etag } = require('../lib/etag');

class HttpResponse {

    constructor(config = {}) {
        this.config = get_class_config(this, config);
    }

    handle_cacheable_request(ctx, cacheable) {

        switch (ctx.request.method) {
            case 'HEAD':
                this.handle_head_get_request(ctx, cacheable, true);
                break;
            case 'OPTIONS':
                this.handle_options_request(ctx);
                break;
            case 'GET': 
                this.handle_head_get_request(ctx, cacheable);
                break;
            default:
                this.handle_simple_request(ctx, 500, {message: `unexpected method ${ctx.request.method}`});
        }

    }

    handle_simple_request(ctx, status = 200, data) {

        const { headers } = this.prepare_headers();

        headers['Cache-Control'] = 'max-age=0, no-store, must-revalidate';
        
        const method = ctx.request.method;

        if (method === 'OPTIONS') {
            if (this.config.allow_methods) headers['Allow'] = this.config.allow_methods.join(', ');
            if (status < 400) data = null;
        } else if (method === 'HEAD') {
            if (status < 400) data = null;
        }

        const origin = ctx.get('Origin');
        if (origin) {
            this.handle_cors_origin(origin, headers);
        }

        if (data && status !== 204 && status !== 304) {
            ctx.body = get_body(data);
            ctx.type = this.config.content_type;
        }

        for (const [key, value] of Object.entries(headers)) ctx.set(key, value);

        ctx.status = status;
    }

    handle_head_get_request(ctx, cacheable, head_only = false) {

        const {headers, now_ms} = this.prepare_headers();

        if (head_only) ctx.status = 204;
        else ctx.status = 200;

        const {data, key, metadata, checksum, timestamp, modified_time, ttl} = cacheable.plain_object;

        const rounded_modified_time = get_rounded_ms(modified_time);

        head_only = this.handle_conditional(ctx, rounded_modified_time, key, checksum, head_only);

        headers['Last-Modified'] = new Date().toGMTString(rounded_modified_time);

        const max_age = Math.round((ttl - (now_ms - timestamp)) / 1000);
        if (max_age > 0) {
            headers['Cache-Control'] = `max-age=${max_age}, private, stale-while-revalidate=${this.config.stale_secs || max_age}`;
            headers['Expires'] = new Date(now_ms + max_age).toGMTString();
        } else {
            headers['Cache-Control'] = 'max-age=0, no-store, must-revalidate';
            headers['Expires'] = new Date(now_ms).toGMTString();
        }

        if (key && checksum) {
            headers['ETag'] = get_etag({ key, checksum });
        }

        const origin = ctx.get('Origin');
        if (origin) {
            this.handle_cors_origin(origin, headers);
        }

        if (data && !head_only) {
            ctx.body = get_body(data);
            if (metadata && metadata['content-type']) {
                ctx.type = metadata['content-type'];
            } else {
                ctx.type = this.config.content_type;
            }
        }

        for (const [key, value] of Object.entries(headers)) {
            ctx.set(key, value);
        }
    }

    handle_conditional(ctx, rounded_modified_time, key, checksum, head_only) {

        const header = ctx.request.header;

        if (header['if-modified-since']) {
            const if_modified_since = Date.parse(header['if-modified-since']);
            if (if_modified_since >= rounded_modified_time) {
                ctx.status = 304;
                return true;
            }
        }

        if (header['if-none-match']) {
            const etags = header['if-none-match'].split(',').map(x => x.trim()).filter(x => x);
            for (const etag of etags) {
                const etag_info = parse_etag(etag);
                if (!etag_info) {
                    continue;
                }
                if (etag_info.key === key && etag_info.checksum === checksum) {
                    ctx.status = 304;
                    return true;
                }
            }
        }

        return head_only;
    }

    handle_options_request(ctx) {

        const { headers } = this.prepare_headers();

        if (this.config.allow_methods) headers['Allow'] = this.config.allow_methods.join(', ');

        const origin = ctx.get('Origin');
        if (origin) {
            this.handle_cors_origin(origin, headers);
        }

        for (const [key, value] of Object.entries(headers)) ctx.set(key, value);

        if (!has_status) ctx.status = 204;
    }

    handle_cors_origin(origin, headers) {

        const {cors_exposed_headers, cors_allow_headers, cors_allowed_methods, cors_secure_context, 
            cors_allow_credentials, cors_max_age} = this.config;

        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Expose-Headers'] = cors_exposed_headers.join(', ');
        headers['Access-Control-Allow-Credentials'] = cors_allow_credentials; 
        headers['Access-Control-Allow-Methods'] = cors_allowed_methods.join(', ');
        headers['Access-Control-Allow-Headers'] = cors_allow_headers.join(', ');
        headers['Access-Control-Max-Age'] = cors_max_age;
        headers['Vary'] = 'Origin';

        if (cors_secure_context) {
            headers['Cross-Origin-Opener-Policy'] = 'same-origin';
            headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        }
    }

    prepare_headers() {

        const headers = {};

        const now_ms = get_rounded_ms();

        if (this.config.server_name) headers['Server'] = this.config.server_name;
        headers['Date'] = new Date(now_ms).toGMTString();

        return {headers, now_ms}
    }
}

function get_rounded_ms(ms = Date.now()) {
    return Math.round( ms / 1000 ) * 1000;
}

module.exports = HttpResponse;