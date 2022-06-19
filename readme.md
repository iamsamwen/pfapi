# strapi-pfapi

a strapi plugin library uses local and redis caches to achieve fast - single digit milliseconds api processing time.

## how to use

### step 1 create strapi app

```bash
yarn create strapi-app strapi-pfapi-app --quickstart 
```

after create and login your Strapi account from browser, stop the strapi server.

### step 2 create plugin pfapi

```bash

yarn strapi generate plugin
? Plugin name pfapi
...
```
follow in the instruction to make the file plugins.js file.

### step 3 create content type: pfapi_config as following:

```json
{
  "kind": "collectionType",
  "collectionName": "pfapi_configs",
  "info": {
    "singularName": "pfapi-config",
    "pluralName": "pfapi-configs",
    "displayName": "pfapi-config"
  },
  "options": {
    "draftAndPublish": true,
    "comment": ""
  },
  "attributes": {
    "name": {
      "type": "string"
    },
    "data": {
      "type": "json"
    }
  }
}
```
