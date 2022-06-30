'use strict';

module.exports = {

    Cacheable: {
    
        // all numbers are in milliseconds
    
        // time to live for data 
        ttl: 900000,
    
        // time to live for info
        info_ttl: 3600000 * 24,
    
        // when it starts to consider as slow
        slow_duration: 500,

        // data age_ms since last update to start refresh
        early_refresh_start: 70000,
    
        // if duration is more than early_refresh_duration, start
        early_refresh_duration: 1000,

        // when to enable refresh
        refresh_duration: 200,
    
        // when it is slow, an extra ttl adds to regular data ttl
        extra_ttl: 60000,
    
    },

    LocalCache: {

        // max size of local cache
        max_size: 4096 * 16,
    
        // default ttl of local cache
        default_ttl: 180000,
    
        // run maintenance interval
        timer_interval: 30000,

    },

    RefreshQueue: {

        batch_size: 64,

        refresh_interval: 180000,

        // refresh the top proportion of queue size
        size_ratio: 0.33,

        // refresh use the proportion of refresh_interval
        time_ratio: 0.33,

        // remove the bottom the proportion of queue size
        remove_ratio: 0.33,

        max_queue_size: 8192 * 2
    },

    PubSub: {
        
        channel_name: 'PUBSUB::CHANNEL',

        exclude_self: false
    },

    HttpResponse: {

        server_name: '',

        stale_secs: null,

        allow_methods: ['GET', 'HEAD', 'OPTIONS'],

        content_type: 'application/json; charset=utf-8',

        cors_exposed_headers: [ 'Authorization', 'Content-Type', 'Accept', 'Accept-Language'],
        cors_allow_headers: [ 'Content-Type', 'Accept', 'Accept-Language'],
        cors_allow_credentials: true,
        cors_allowed_methods: ['GET', 'HEAD', 'OPTIONS'],
        cors_max_age: 2592000,

    },

    LifecycleEventsSubscription: {
        uids: [],
    }
};