'use strict';

const fs = require('fs');
const node_path = require('path');

/**
 * specific for strapi running environment
 * 
 * @returns project root
 */

/**
 *  specific for strapi running environment
 * 
 * @param {*} relative_dirname related to project root
 *                             for example: src/plugins/xyz/code_folder
 * 
 * @param {*} full_dirname __dirname
 * @returns 
 */
module.exports = (relative_dirname, full_dirname) => {
    
    if (global.strapi) {
        return global.strapi.dirs.root;
    }
    
    let path;

    if (relative_dirname && full_dirname) {
        
        if (full_dirname.includes('node_modules')) {

            path = full_dirname;

        } else if (full_dirname.endsWith(relative_dirname)) {

            let length = full_dirname.length - relative_dirname.length;
            if (!relative_dirname.startsWith('/')) length--;

            const root = full_dirname.slice(0, length);

            if (is_strapi_project_root(root)) {
                return root;
            }
        }

    }

    if (!path) path = require.main.filename;

    const index = path.indexOf('node_modules');

    if (index !== -1) {

        const root = path.slice(0, index - 1);
        
        if (is_strapi_project_root(root)) {
            return root;
        }

    }

    throw new Error('failed to find project root directory');
}

function is_strapi_project_root(root) {

    if (!fs.existsSync(node_path.join(root, 'config'))) {
        return false;
    }
    if (!fs.existsSync(node_path.join(root, 'public'))) {
        return false;
    }
    if (!fs.existsSync(node_path.join(root, 'src'))) {
        return false;
    }
    if (!fs.existsSync(node_path.join(root, 'src', 'admin'))) {
        return false;
    }
    if (!fs.existsSync(node_path.join(root, 'src', 'api'))) {
        return false;
    }

    return true;
}