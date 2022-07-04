'use strict';

module.exports = {
    fatal,
    error,
    warn,
    info,
    debug
}

function fatal(message) {
    if (global.strapi) {
        global.strapi.log.fatal(message);
    } else {
        console.error('FATAL', message);
    }
}

function error(message) {
    if (global.strapi) {
        global.strapi.log.error(message);
    } else {
        console.error('ERROR', message);
    }
}

function warn(message) {
    if (global.strapi) {
        global.strapi.log.warn(message);
    } else {
        console.warn('WARN', message);
    }
}

function info(message) {
    if (global.strapi) {
        global.strapi.log.info(message);
    } else {
        console.log('INFO', message);
    }
}

function debug(message) {
    if (process.env.DEBUG) {
        if (global.strapi) {
            global.strapi.log.debug(message);
        } else {
            console.log('DEBUG', message);
        }
    }
}
