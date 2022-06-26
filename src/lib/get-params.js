'use strict';

const fp = require('lodash/fp');

module.exports = (ctx) => {
    const params = fp.cloneDeep(ctx.query);
    if (ctx.params) {
        for (const [key, value] of Object.entries(ctx.params)) {
            if (key === '0') continue;
            params[key] = value;
        }
    }
    return params;
}