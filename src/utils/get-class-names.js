'use strict';

module.exports = (instance) => {
    const class_names = [ ];
    let target = instance.constructor;
    while (target.name) {
        class_names.unshift(target.name);
        target = Object.getPrototypeOf(target);
    }
    return class_names;
};