# strapi-pfapi

**P** stands for Powerful, **F** stands for Fast.

strapi-pfapi is a library that helps write Strapi Plugins to provide powerful, secure and fast API services.

It uses local and Redis caches to keep data. Strapi life cycle events help to evict invalid cached data. It refreshes the data before or after expiration for slow apis based on a priority score. The score calculates from api usage and duration. 

With database indexing and query optimizations, the single-digit milliseconds API average response time goal is achievable for most web applications.

strapi-pfapi uses HTTP headers: etag, cache-control, expires, if-modified-since and if-none-match to take advantage of the browser-side cache. It reliefs impact of round-trip delay and data traffic between browser and api server.

The Refreshable class makes it possible to get data from Strapi Entity Service API, Query Engine API, other API services and databases. The Composite class aggregates multiple Refreshable results and name value components of dynamic zone into one response. Query params, such as fields, filters, populate, etc., are defined in the config and accessible without delay through the local cache.

It supports production environment that runs multiple Strapi servers and Redis cluster to avoid single-point failure. It auto-reconnects to the Redis server if it restarted.

It is powerful, extensible, and can efficiently serve the data retrieving services covered by Strapi content-type APIs.

## how it works

Please refer to <a href="https://github.com/iamsamwen/strapi-plugin-pfapi">strapi-plugin-pfapi</a> to see how it works.

## how to use

use strapi-plugin-pfapi as an example.



