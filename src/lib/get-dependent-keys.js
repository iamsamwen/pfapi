'use strict';

const get_dependency_key = require('./get-dependency-key');

module.exports = (dependencies) => {
    const dependent_keys = [];
    if (dependencies.length === 0) return dependent_keys
    try {
        const uids = [];
        for (const {uid, id} of dependencies) {
            if (!uid) continue;
            if (!uids.includes(uid)) uids.push(uid)
            const key = get_dependency_key({uid, id});
            if (key) dependent_keys.push(key);
        }
        if (global.PfapiApp) {
            for (const uid of uids) {
                global.PfapiApp.subscribe_db_events(uid);
            }
        }
        return dependent_keys;
    } catch(err) {
        console.error(err.message);
    }
    return null;
}