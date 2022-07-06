'use strict';

const find_project_root = require('./find-project-root');

module.exports = {
    set,
    get
};

let project_root_dir;

function set(root_dir) {
    project_root_dir = root_dir;
}

function get() {
    if (!project_root_dir) {
        project_root_dir = find_project_root();
    }
    return project_root_dir;
}
