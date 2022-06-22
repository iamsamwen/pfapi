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
    
    const strapi_bin_path = '/node_modules/@strapi/strapi/bin';

    let start_dir = node_path.dirname(require.main.filename);
    
    if (start_dir.endsWith(strapi_bin_path)) {
        project_root_dir = start_dir.slice(0, start_dir.length - strapi_bin_path.length);
        return project_root_dir;
    }

    if (start_dir.split(node_path.sep).includes('node_modules')) {
        start_dir = node_path.dirname(node_path.dirname(__dirname));
    }

    project_root_dir = find_files(start_dir, ['.env', 'package.json', 'node_modules', 'src', 'config', 'database', 'public'], ['strapi-server.js']);
    if (project_root_dir) return project_root_dir;
    
    throw new Error('failed to find project root directory');
}

let root;

function find_files(dir, files, not_files) {

    if (!root) root = (os.platform === "win32") ? process.cwd().split(node_path.sep)[0] : '/';
    
    while (dir && dir !== root) {
        let found_all = true;
        for (const file of not_files) {
            if (fs.existsSync(node_path.join(dir, file))) {
                found_all = false;
                break;
            }
        }
        if (!found_all) {
            dir = node_path.dirname(dir);
            continue;
        }
        for (const file of files) {
            if (!fs.existsSync(node_path.join(dir, file))) {
                found_all = false;
                break;
            }
        }
        if (found_all) break;
        dir = node_path.dirname(dir);
    }
    
    if (!dir || dir === root) return null;
    return dir;
}