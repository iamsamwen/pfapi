'use strict';

const normalize_config = require('./normalize-config');
const { config_uid } = require('./uids-config');

module.exports = async (strapi, key) => {
    const result = await strapi.db.query(config_uid).findOne({where: { key }}) || {};
    return normalize_config(result);
}