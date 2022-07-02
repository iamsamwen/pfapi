'use strict';

const os = require("os");
const fs = require('fs');
const node_path = require('path');

let project_root_dir;

module.exports = {
    set,
    get,
    find,
};

function set(root_dir) {
    project_root_dir = root_dir;
}

function get() {
    if (!project_root_dir) find();
    return project_root_dir;
}

/**
 * specific for strapi running environment
 * 
 * @returns project root
 */
function find() {
    
    if (global.strapi) {

        project_root_dir = global.strapi.dirs.root;

        return project_root_dir;
    
    } else {
        
        throw new Error('failed to find project root directory');
    }
}