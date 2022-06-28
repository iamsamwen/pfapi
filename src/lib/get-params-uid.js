'use strict';

module.exports = (strapi, local_cache, config, handle) => {
    if (config && config.uid) {
        return config.uid;
    } else if (handle) {
        const cache_key = `api_uid::${handle}`;
        let uid = local_cache.get(cache_key);
        if (uid) {
            return uid;     
        } else {
            for (const [key, value] of Object.entries(strapi.contentTypes)) {
                if (!key.startsWith('api::')) continue;
                const {info: {pluralName}} = value;
                if (handle === pluralName) {
                    uid = key;
                    local_cache.put(cache_key, uid);
                    break;
                }
            }
            return uid;
        }
    }
}