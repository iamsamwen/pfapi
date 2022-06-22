'use strict';

module.exports = (value) => {
    if (typeof value === 'string' && value !== '') {
        try {
            value = JSON.parse(value);
        } catch(err) {
            //console.error(err.message);
        }
    }
    return value;
}