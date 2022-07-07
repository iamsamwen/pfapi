'use strict';

const chai = require('chai');
const ip_prefix_matched = require('../../src/utils/ip-prefix-matched');

const expect = chai.expect;
const assert = chai.assert;

// NODE_ENV=test mocha --reporter spec tests/utils/test-ip-prefix-matched

describe('Test ip-prefix-matched', () => {

    it('ip null prefix null', async () => {
        const status1 = ip_prefix_matched({ip: '1.2.3.4', path: '/home'}, [{ip: null, prefix: null, status: 'white-list'}]);
        expect(status1).equals('white-list');

        const status2 = ip_prefix_matched({ip: '1.2.3.4', path: '/home'}, [{ip: null, prefix: null, status: 'black-list'}]);
        expect(status2).equals('black-list');
    });

    it('ip match prefix null', async () => {
        const status1 = ip_prefix_matched({ip: '1.2.3.4', path: '/home'}, [{ip: '1.2.3.0/24', prefix: null, status: 'white-list'}]);
        expect(status1).equals('white-list');

        const status2 = ip_prefix_matched({ip: '1.2.3.4', path: '/home'}, [{ip: '1.2.4.0/24', prefix: null, status: 'black-list'}]);
        expect(status2).equals(false)
    })

    it('ip null prefix match', async () => {
        const status1 = ip_prefix_matched({ip: '1.2.3.4', path: '/home/page'}, [{ip: null, prefix: '/home/', status: 'white-list'}]);
        expect(status1).equals('white-list');

        const status2 = ip_prefix_matched({ip: '1.2.3.4', path: '/home/page'}, [{ip: null, prefix: '/admin/', status: 'black-list'}]);
        expect(status2).equals(false);
    })

    it('white hole in a black list', async () => {

        const list = [
            {ip: '1.2.3.0/24', prefix: '/admin/', status: 'white-list'},
            {ip: null, prefix: '/admin/', status: 'black-list'},
        ];

        const status1 = ip_prefix_matched({ip: '1.2.3.4', path: '/admin/login'}, list);
        expect(status1).equals('white-list');

        const status2 = ip_prefix_matched({ip: '1.3.3.4', path: '/admin/login'}, list);
        expect(status2).equals('black-list');
    })

    it('black hole in a white list', async () => {

        const list = [
            {ip: null, prefix: '/admin/', status: 'black-list'},
            {ip: null, prefix: '/', status: 'white-list'},
        ];

        const status1 = ip_prefix_matched({ip: '1.2.3.4', path: '/admin/login'}, list);
        expect(status1).equals('black-list');

        const status2 = ip_prefix_matched({ip: '1.3.3.4', path: '/home'}, list);
        expect(status2).equals('white-list');
    })
});