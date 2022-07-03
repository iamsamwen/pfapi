'use strict';

const util = require('util');
const get_checksum = require('../utils/get-checksum');
const uids_config = require('./uids-config');

class PfapiUids {
    
    constructor(app) {

        this.app = app,
        this.strapi = app.strapi;
        this.local_cache = app.local_cache;
    }

    async start(sync_interval) {

        this.setup_lifecycle_events_subscription();

        await this.load_all();
        this.synced_at_ms = Date.now();

        this.sync_timer = setInterval(async () => {

            await this.load_all();
            this.synced_at_ms = Date.now();

        }, sync_interval);
    }

    async stop() {
        if (this.sync_timer) {
            clearInterval(this.sync_timer);
        }
    }

    async setup_lifecycle_events_subscription() {

        const uids = Object.values(uids_config);

        for (const uid of uids) {
            if (uid === uids_config.state_uid || uid === uids_config.roles_uid) continue;
            this.app.subscribe_lifecycle_events(uid, false);
        }

        const { lifecycle_uids } = await this.strapi.db.query(uids_config.state_uid).findOne() || {};
 
        if (lifecycle_uids && lifecycle_uids.length > 0) {
            for (const uid of lifecycle_uids) {
                if (!this.strapi.contentTypes[uid]) continue;
                this.app.subscribe_lifecycle_events(uid, false);
            }
        }
    }

    async load_ips() {

        if (!this.strapi.contentTypes[uids_config.ips_uid]) {
            console.error(`${this.ips_uid} not found`);
            return;
        }

        const items = await this.strapi.entityService.findMany(uids_config.ips_uid);

        if (items.length > 0) {
            
            const white_list = [], black_list = [];
            for (const {ip, status} of items) {
                if (status === 'white-list') white_list.push(ip);
                if (status === 'black-list') black_list.push(ip);
            }

            const config_key = this.app.get_config_key(uids_config.ips_uid);
            this.local_cache.put(config_key, { white_list, black_list }, true);

        } else if (!this.synced_at_ms) {

            const config = this.app.get_app_config('Ip');
            if (config && Array.isArray(config) && config.length > 0) {
                for (const data of config) {
                    await this.strapi.entityService.create(uids_config.ips_uid, {data});
                }
            }
        }
    }

    async load_api_keys() {

        if (!this.strapi.contentTypes[uids_config.keys_uid]) {
            console.error(`${uids_config.keys_uid} not found`);
            return;
        }

        const items = await this.strapi.entityService.findMany(uids_config.keys_uid, {filters: {blocked: false}, populate: '*'});
        
        if (items.length > 0) {

            for (const { key, role} of items) {
                if (!role || !role.name) continue;
                const config_key = this.app.get_config_key(uids_config.keys_uid, {key})
                this.local_cache.put(config_key, role.name, true);
            }

        } else if (!this.synced_at_ms) {

            const role_config = this.app.get_app_config('DemoRole');
            const key_config = this.app.get_app_config('DemoKey');

            if (role_config && key_config) {
                const { name } = role_config;
                const count = await this.strapi.entityService.count(uids_config.roles_uid, {filters: {name}});
                if (count === 0) {
                    const { id } = await this.strapi.entityService.create(uids_config.roles_uid, {data: role_config});
                    if (id) {
                        const data = { ...key_config };
                        data.role = id;
                        data.key += '-' + String(10000000 + Math.floor(Math.random() * 10000000));
                        await this.strapi.entityService.create(uids_config.keys_uid, {data});
                    }
                }
            }
        }
    }

    async load_permissions() {

        if (!this.strapi.contentTypes[uids_config.permissions_uid]) {
            console.error(`${uids_config.permissions_uid} not found`);
            return;
        }

        const items = await this.strapi.entityService.findMany(uids_config.permissions_uid, {
            filters: {$or: [{action: {$endsWith: '.find'}}, {action: {$endsWith: '.findOne'}}]}, 
            populate: '*'
        });
        //console.log(util.inspect(items, false, null, true));
        const permissions = {};
        for (const {action, role: {name}} of items) {
            let roles = permissions[action];
            if (!roles) {
                roles = permissions[action] = []; 
            }
            permissions[action].push(name);
        }

        const config_key = this.app.get_config_key(uids_config.permissions_uid);
        //console.log({ config_key, permissions});
        this.local_cache.put(config_key, permissions, true);
    }

    async load_rate_limits() {

        if (!this.strapi.contentTypes[uids_config.rate_limits_uid]) {
            console.error(`${uids_config.rate_limits_uid} not found`);
            return;
        }

        const items = await this.strapi.entityService.findMany(uids_config.rate_limits_uid);

        let rate_limits = [];

        if (items.length > 0) {

            for (const { ip_mask, prefix, window_secs, max_count, block_secs} of items) {
                if (!ip_mask || !window_secs || !max_count) continue;
                rate_limits.push({ip_mask, prefix, window_secs, max_count, block_secs});
            }
            this.app.throttle.apply_rate_limits(rate_limits);

        } else if (!this.synced_at_ms) {

            const rate_limits = this.app.get_app_config('RateLimit');
            if (rate_limits) {
                for (const entry of rate_limits) {
                    await this.strapi.entityService.create(uids_config.rate_limits_uid, {data: entry});
                }
            }
        }
    }

    async load_handles() {

        if (!this.strapi.contentTypes[uids_config.handle_uid]) {
            console.error(`${uids_config.handle_uid} not found`);
            return;
        }

        const items = await this.strapi.entityService.findMany(uids_config.handle_uid, {populate: '*'});
        console.log(util.inspect(items, false, null, true));
        if (items.length > 0) {
            for (const item of items) this.app.update_config(uids_config.handle_uid, item);
        }
    }

    async load_uid_models() {
        const models = {};
        for (const [uid, value] of Object.entries(this.strapi.contentTypes)) {
            const {info: {pluralName}} = value;
            models[pluralName] = uid;
        }
        const cache_key = get_checksum('uid_models');
        this.local_cache.put(cache_key, models, true);
    }

    async load_all() {
        await this.load_api_keys();
        await this.load_ips();
        await this.load_permissions();
        await this.load_rate_limits();
        await this.load_handles();
        this.load_uid_models()
    }
}

module.exports = PfapiUids;