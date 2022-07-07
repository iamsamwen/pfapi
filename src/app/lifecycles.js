'use strict';

const debug_verbose = require('debug')('pfapi-verbose:lifecycles');
const logging = require('./logging');
const uids_config = require('./uids-config');

const Netmask = require('netmask').Netmask;
const { matches } = require('ip-matching');

module.exports = (app, uid) => {
    const result = {
        models: [uid],
        afterCreate(event) {
            debug_verbose(uid, logging.cmsg(event));
            app.after_upsert(event);
        },
        afterUpdate(event) {
            debug_verbose(uid, logging.cmsg(event));
            app.after_upsert(event);
        },
        afterDelete(event) {
            debug_verbose(uid, logging.cmsg(event));
            app.after_delete(event);
        },
    };
    if (uid === uids_config.files_uid) {
        delete result.afterCreate;
    }
    if (uid === uids_config.handle_uid) {
        result.beforeFindOne = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            update_component_media_populate(event);
        }
        result.beforeFindMany = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            update_component_media_populate(event);
        }
    }
    if (uid === uids_config.ips_uid) {
        result.beforeCreate = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            validate_ip(app, event);
        }
        result.beforeUpdate = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            validate_ip(app, event);
        }
    }
    if (uid === uids_config.rate_limits_uid) {
        result.beforeCreate = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            validate_ip_mask(app, event);
        }
        result.beforeUpdate = (event) => {
            //debug_verbose(uid, logging.cmsg(event));
            validate_ip_mask(app, event);
        }
    }
    return result;
}

function update_component_media_populate(event) {
    if (event.params && event.params.populate) {
        event.params.populate = { attributes: { populate: { media: true } } };
    }
}

function validate_ip(app, event) {
    if (event.params && event.params.data && event.params.data.ip) {
        try {
            matches('1.2.3.4', event.params.data.ip);
        } catch (err) {
            event.params.data.comment = `${event.params.data.ip}: ${err.message}`;
            event.params.data.ip = 'invalid';
            logging.error(err.message);
        }
    }
}

function validate_ip_mask(app, event) {
    if (event.params && event.params.data && event.params.data.ip_mask) {
        try {
            new Netmask('1.2.3.4', event.params.data.ip_mask);
        } catch (err) {
            event.params.data.comment = err.message;
            event.params.data.ip_mask = 'invalid';
            logging.error(err.message);
        }
    }
}