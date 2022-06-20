'use strict';

const chai = require('chai');
const get_start_limit = require('../../src/lib/get-start-limit');

const expect = chai.expect;

// NODE_ENV=test mocha --reporter spec tests/lib/test-get-start-limit

describe('Test get-start-limit', () => {

    it('empty', async () => {
        const start_limit = get_start_limit();
        //console.log( start_limit);
        expect( start_limit).to.deep.equal([ 0, 20 ]);
    });

    it('string start', async () => {
        const  start_limit = get_start_limit({start: '20'});
        //console.log(start_limit);
        expect(start_limit).to.deep.equal([ 20, 20 ]);
    });

    it('string limit', async () => {
        const  start_limit = get_start_limit({limit: '10'});
        //console.log(start_limit);
        expect(start_limit).to.deep.equal([ 0, 10 ]);
    });

    it('pageSize', async () => {
        const  start_limit = get_start_limit({pageSize: '10'});
        //console.log(start_limit);
        expect(start_limit).to.deep.equal([ 0, 10 ]);
    });

    it('page', async () => {
        const  start_limit = get_start_limit({page: '2', pageSize: '10'});
        //console.log(start_limit);
        expect(start_limit).to.deep.equal([ 10, 10 ]);
    });
});