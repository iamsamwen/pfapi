'use strict';

const chai = require('chai');
const get_class_names = require('../../src/lib/get-class-names');

const expect = chai.expect;

// NODE_ENV=test mocha --reporter spec tests/lib/test-get-class-names

describe('Test get-class-names', () => {

    it('simple', async () => {

        class A {};
        class B extends A {};
        class C extends B {};

        const names = get_class_names(new C());
        //console.log(names);
        expect(names).to.deep.equal(['A', 'B', 'C']);
    });

});