'use strict';

const chai = require('chai');
const get_body = require('../../src/lib/get-body');

const expect = chai.expect;

// NODE_ENV=test mocha --reporter spec tests/lib/test-get-body

describe('Test get-body', () => {

    it('undefined', async () => {
        const body = get_body(undefined);
        //console.log(body);
        expect(body).equals('');
    });

    it('null', async () => {
        const body = get_body(null);
        //console.log(body);
        expect(body).equals('');
    });

    it('string', async () => {
        const body = get_body('string');
        //console.log(body);
        expect(body).equals('string');
    });

    it('buffer', async () => {
        const body = get_body(Buffer.from('string', 'utf-8'));
        //console.log(body);
        expect(body).equals('string');
    });

    it('number', async () => {
        const body = get_body(1);
        //console.log(body);
        expect(body).equals('1');
    });

    it('object', async () => {
        const body = get_body({x: 1});
        //console.log(body);
        expect(body).equals('{"x":1}');
    });

    it('array', async () => {
        const body = get_body([1]);
        //console.log(body);
        expect(body).equals('[1]');
    });
});