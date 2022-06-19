'use strict';

const get_class_config = require('./get-class-config');

class Composite {

    constructor(config = {}) {
        Object.assign(this, get_class_config(this, config));
    }

    transform(data, params) {
        console.log('composite transform not implemented yet');
    }
}

module.exports = Composite;