# strapi-pfapi

a strapi plugin library uses local and redis caches to achieve pretty fast - single digit milliseconds on average api processing time.

## how to use

### step 1 create strapi app

```bash
yarn create strapi-app strapi-pfapi-app --quickstart 
```

after create and login your Strapi account from browser, stop the strapi server.

### step 2 install [strapi-plugin-pfapi][https://github.com/iamsamwen/strapi-plugin-pfapi]

```bash
cd strapi-pfapi-app

yarn add strapi-plugin-pfapi
```

### step 3 create test content-type and insert few rows of data

http://localhost:1337/admin/plugins/content-type-builder

### step 4 test pfapi


http://localhost:1337/pfapi/test/find-one/1

http://localhost:1337/pfapi/test/find-many


assuming the name of the content-type you created is test

