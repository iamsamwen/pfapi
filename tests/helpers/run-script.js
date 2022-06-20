'use strict';

const { exec } = require("child_process");

module.exports = {
    run_script,
    get_stdout,
};

let result = '';

function run_script(cmd) {
    return new Promise(resolve => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                resolve(false);
            } else if (stderr) {
                console.log(`stderr: ${stderr}`);
                resolve(false);
            } else {
                result = stdout.toString();
                resolve(result);
            }
        });
    });
}

function get_stdout() {
    return result;
}