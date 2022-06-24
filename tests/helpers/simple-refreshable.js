'use strict';

const project_root = require('../../src/lib/project-root');
const Refreshable = require('../../src/models/refreshable');
const sleep = require('./sleep');

project_root.set(process.cwd());

class SimpleRefreshable extends Refreshable {
    async get_data({delay_ms = 10}) {
        await sleep(delay_ms);
        const data = {delayed_ms: delay_ms};
        const content_type = 'application/json';
        return {data, content_type};
    }
}

module.exports = new SimpleRefreshable(__filename);