'use strict';

const uids_config = require('./uids-config');
const logging = require('./logging');

module.exports = (app, uid) => {
    const result = {
        models: [uid],
        afterCreate(event) {
            logging.debug(uid, event);
            app.after_upsert(event);
        },
        afterUpdate(event) {
            logging.debug(uid, event);
            app.after_upsert(event);
        },
        afterDelete(event) {
            logging.debug(uid, event);
            app.after_delete(event);
        },
    };
    if (uid === uids_config.files_uid) {
        delete result.afterCreate;
    }
    if (uid === uids_config.handle_uid) {
        result.beforeFindOne = (event) => {
            logging.debug(uid, event);
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
        result.beforeFindMany = (event) => {
            logging.debug(uid, event);
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
    }
    return result;
}