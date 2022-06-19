# strapi-pfapi

a strapi plugin library uses local and redis caches to achieve pretty fast - single digit milliseconds on average api processing time.

## how to use

before starting, please <a href="https://redis.io/docs/getting-started/">install redis server</a> on your local computer.

### step 1 create strapi app

```bash
yarn create strapi-app strapi-pfapi-app --quickstart 
```

after create and login your Strapi account from browser, stop the strapi server.

### step 2 install <a href="https://github.com/iamsamwen/strapi-plugin-pfapi">strapi-plugin-pfapi</a>. The plugin uses this library as npm package.

```bash
cd strapi-pfapi-app

yarn add strapi-plugin-pfapi
```

### step 3 create test content-type and insert few rows of data

http://localhost:1337/admin/plugins/content-type-builder

### step 4 test pfapi

http://localhost:1337/pfapi/test/find-one/1

http://localhost:1337/pfapi/test/find-many

http://localhost:1337/pfapi/test/get-count

http://localhost:1337/pfapi/test/get-composite

assuming the name of the content-type you created is test

