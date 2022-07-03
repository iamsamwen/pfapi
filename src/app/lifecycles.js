'use strict';

const util = require('util');
const uids_config = require('./uids-config');

module.exports = (app, uid) => {
    const result = {
        models: [uid],
        afterCreate(event) {
            if (process.env.DEBUG_LIFECYCLES) {
                console.log(uid, util.inspect(event, false, null, true));
            }
            app.after_upsert(event);
        },
        afterUpdate(event) {
            if (process.env.DEBUG_LIFECYCLES) {
                console.log(uid, util.inspect(event, false, null, true));
            }
            app.after_upsert(event);
        },
        afterDelete(event) {
            if (process.env.DEBUG_LIFECYCLES) {
                console.log(uid, util.inspect(event, false, null, true));
            }
            app.after_delete(event);
        },
    };

    if (uid === uids_config.handle_uid) {
        result.beforeFindOne = (event) => {
            if (process.env.DEBUG_LIFECYCLES) {
                console.log(uid, util.inspect(event, false, null, true));
            }
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
        result.beforeFindMany = (event) => {
            if (process.env.DEBUG_LIFECYCLES) {
                console.log(uid, util.inspect(event, false, null, true));
            }
            if (event.params.populate) {
                event.params.populate = { attributes: { populate: { media: true } } };
            }
        }
    }
    return result;
}