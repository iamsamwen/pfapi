'use strict';

const util = require('util');

module.exports = (app, uid) => {
    return {
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
}