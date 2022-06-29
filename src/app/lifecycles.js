'use strict';

module.exports = (app, uid) => {
    return {
        models: [uid],
        afterCreate(event) {
            app.after_upsert(event);
        },
        afterUpdate(event) {
            app.after_upsert(event);
        },
        afterDelete(event) {
            app.after_delete(event);
        },
    };
}