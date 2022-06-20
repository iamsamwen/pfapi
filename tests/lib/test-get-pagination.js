'use strict';

const chai = require('chai');
const get_pagination = require('../../src/lib/get-pagination');

const expect = chai.expect;

// NODE_ENV=test mocha --reporter spec tests/lib/test-get-pagination

describe('Test get-pagination', () => {

    it('empty', async () => {
        const pagination = get_pagination();
        //console.log(pagination);
        expect(pagination).to.deep.equal({ total: 0, pageSize: 20, page: 1, pageCount: 0 });
    });

    it('string', async () => {
        const pagination = get_pagination({start: '1', limit: '10', total: 101});
        //console.log(pagination);
        expect(pagination).to.deep.equal({ total: 101, pageSize: 10, page: 1, pageCount: 11 });
    });
});