'use strict';

const util = require('util');

module.exports = {
    fatal,
    error,
    warn,
    info,
    debug
}

function fatal(...args) {
    const message = get_message(args);
    if (global.strapi) {
        global.strapi.log.fatal(message);
    } else {
        console.error('FATAL', message);
    }
}

function error(...args) {
    const message = get_message(args);
    if (global.strapi) {
        global.strapi.log.error(message);
    } else {
        console.error('ERROR', message);
    }
}

function warn(...args) {
    const message = get_message(args);
    if (global.strapi) {
        global.strapi.log.warn(message);
    } else {
        console.warn('WARN', message);
    }
}

function info(...args) {
    const message = get_message(args);
    if (global.strapi) {
        global.strapi.log.info(message);
    } else {
        console.log('INFO', message);
    }
}

function debug(...args) {
    if (process.env.DEBUG) {
        const message = get_message(args);
        if (global.strapi) {
            global.strapi.log.debug(message);
        } else {
            console.log('DEBUG', message);
        }
    }
}

function get_message(args) {
    let message = '';
    for (const value of args) {
        if (message !== '') message += ' ';
        if (typeof value === 'object') {
            message += util.inspect(value, false, null, true);
        } else {
            message += String(value);
        }
    }
    return message;
}