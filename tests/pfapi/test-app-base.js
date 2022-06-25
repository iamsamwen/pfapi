'use strict';

const chai = require('chai');
const axios = require('axios');

const { run_script2, kill_script } = require('../helpers/run-script');
const sleep = require('../helpers/sleep');

const expect = chai.expect;

// NODE_ENV=test mocha --timeout 30000 --reporter spec tests/pfapi/test-app-base

describe('Test app-base', () => {
   
    before(async() => {
        await run_script2('node', `${process.cwd()}/tests/helpers/koa-server.js`);
    });

    it('test random', async () => {

        const {status, headers, data} = await axios.get('http://localhost:3000/random');
        //console.log(status, headers, data);
        expect(status).equals(200);
        expect(headers).has.ownProperty('date')
        expect(headers).has.ownProperty('last-modified')
        expect(headers).has.ownProperty('etag')
        expect(headers).has.ownProperty('cache-control');
        expect(headers).has.ownProperty('expires')
        expect(headers).has.ownProperty('x-response-time')
        expect(data).has.ownProperty('delayed_ms')
    });

    it('test composite', async () => {

        const {status, headers, data} = await axios.get('http://localhost:3000/composite');
        //console.log(status, headers, data);
        expect(status).equals(200);
        expect(headers).has.ownProperty('date')
        expect(headers).has.ownProperty('last-modified')
        expect(headers).has.ownProperty('etag')
        expect(headers).has.ownProperty('cache-control');
        expect(headers).has.ownProperty('expires')
        expect(headers).has.ownProperty('x-response-time')
        expect(data).has.ownProperty('title');
        expect(data).has.ownProperty('random');
        expect(data).has.ownProperty('simple');
    });

    after(() => {
        kill_script();
    })
});