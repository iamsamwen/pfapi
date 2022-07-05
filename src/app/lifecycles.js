'use strict';

const debug_verbose = require('debug')('pfapi-verbose:lifecycles');
const logging = require('./logging');
const uids_config = require('./uids-config');

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
            debug_verbose(uid, logging.cmsg(event));
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
        result.beforeFindMany = (event) => {
            debug_verbose(uid, logging.cmsg(event));
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
    }
    return result;
}