'use strict';

/**
 * used by cacheable
 * 
 * params contains query related data
 * module_path: relative refreshable module path to project root
 * content_type: for content-type of HTTP response
 * timestamp: time in milliseconds after calling get data
 * modified_time: last time in milliseconds when data was modified
 * created_time: first time in milliseconds data was created
 * ttl: time in milliseconds to live
 * duration: time used in milliseconds for calling get data
 * count: sampled usage count, when data is get from local cache, it is not counted
 * permanent: indicates it never expires locally
 */
module.exports = [ 'params', 'module_path', 'content_type', 'checksum', 'timestamp', 
    'modified_time', 'created_time', 'ttl', 'duration', 'count', 'permanent' ];