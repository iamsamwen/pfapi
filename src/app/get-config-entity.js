'use strict';

module.exports = (input) => {
    let {data, attributes, ...rest} = input;
    if (attributes && !Array.isArray(attributes)) {
        const items = [];
        for (const [name, value] of Object.entries(attributes)) {
            if (!name) continue;
            items.push(get_component_item(name, value));
        }
        if (items.length > 0) attributes = items;
        else attributes = null;
    }
    if (attributes) rest.attributes = attributes;
    if (data && !Array.isArray(data)) {
        const items = [];
        for (const [name, value] of Object.entries(data)) {
            if (!name) continue;
            items.push(get_component_item(name, value));
        }
        if (items.length > 0) data = items;
        else data = null;
    }
    if (data) rest.data = data;
    return rest;
}

function get_component_item(name, value) {
    const type = typeof value;
    let __component = 'pfapi-types.text';
    if (value === null) {
        return {__component, name, value};
    } else if (type === 'number') {
        if (Number.isInteger(value)) __component = 'pfapi-types.integer';
        else __component = 'pfapi-types.decimal';
    } else if (type === 'boolean') {
        __component = 'pfapi-types.bool';
    } else if (type === 'object') {
        if (value.mime && value.url) {
            __component = 'pfapi-types.media';
            return {__component, name, media: value}
        } else if (Array.isArray(value)) {
            let is_multimedia = true; 
            for (const item of value) {
                if (!item.mime || !item.url) {
                    is_multimedia = false;
                    break;
                }
            }
            if (is_multimedia) {
                __component = 'pfapi-types.multimedia';
                return {__component, name, media: value}
            } else {
                __component = 'pfapi-types.json';
            }
        } else {
            __component = 'pfapi-types.json';
        }
    } else if (/<p>|<h\d>|<em>|<a /i.test(value)) {
        __component = 'pfapi-types.richtext';
    }
    return {__component, name, value};
}