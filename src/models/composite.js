'use strict';

/**
 * Composite provides mechanism to aggregate multiple data sources in one response
 * 
 * 1) static data: defined within the subclass
 * 2) configurable data: config referred by name, all key values from config data attributes
 * 3) refreshable: will call get_data    
 */
class Composite {

    // static data

    // for example:
    // title: 'static title';

    // refreshable

    // for examples:
    // items = find_many; // refreshable 
    // total = get_total; // refreshable

    // if params has property name, it will get config with the name
    // if the config has property attributes, key and values of the 
    // attributes object will assign to the data object

    transform(data, params) {
        console.log('composite transform not implemented yet');
    }
}

module.exports = Composite;