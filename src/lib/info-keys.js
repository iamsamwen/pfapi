'use strict';

/**
 * params contains query related data
 * module_path relative refreshable module path to project root
 * metadata content-type etc
 * timestamp time in milliseconds called refreshable get data
 * modified_time last time in milliseconds it was modified
 * created_time first time in milliseconds it was created
 * ttl time in milliseconds to live
 * duration time used in milliseconds to call refreshable get data
 * count usage count
 * permanent indicates it never expires locally
 */
module.exports = [ 'params', 'module_path', 'metadata', 'checksum', 'timestamp', 'modified_time', 'created_time', 'ttl', 'duration', 'count', 'permanent' ];