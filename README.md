# redis-registry

[![Build Status](https://travis-ci.org/koalazak/redis-registry.svg?branch=master)](https://travis-ci.org/koalazak/redis-registry)
[![npm version](https://badge.fury.io/js/redis-registry.svg)](http://badge.fury.io/js/redis-registry)

Service registry and discovery for Node.js on top of [redis](https://github.com/NodeRedis/node_redis)

## Install

```bash
npm install redis-registry
```

## Usage

``` js
const registry = require('redis-registry');

const redisConfig = {
  host: '192.168.1.50',
  port: 6379
}
const services = registry(redisConfig);

// Join the registry
services.join('my-service-name', {port:8080});

// Wait a bit and do a lookup
services.lookup('my-service-name', function(err, service) {
  console.log('Found the following service:');
  console.log(service);
});

```

Running the above [example](https://github.com/koalazak/redis-registry/blob/master/example.js) will produce the following output

```
Found the following service:
{
  name: 'my-service-name',
  port: 8080,
  hostname: '192.168.1.10',
  host: '192.168.1.10:8080',
  url: 'http://192.168.1.10:8080'
}
```

## Full api

* `services = registry(redisConfig)` Create a new registry client
* `services.join(name, service, [cb])` Join the registry with a new service
* `services.leave([name], [cb])` Leave the registry.
* `services.lookup(name, cb)` Lookup a single service
* `services.list([name], cb)` List all services as an array. Omit the name to list all services

## Services

Services are just JSON documents. `redis-registry` will add a default `hostname` and a couple of other properties.
An example of a service document could be:

``` js
{
  name: 'my-service',
  port: 8080,
  hostname: '192.168.1.10',       // added by redis-registry
  host: '192.168.1.10:8080',      // added by redis-registry
  url: 'http://192.168.1.10:8080' // added by redis-registry
}
```

These documents are saved in [redis](https://redis.io/) with a TTL of 10s.
Every 5s `redis-registry` will send a heartbeat for each service to the registry which resets the expiration counter.
If possible you should call `services.leave()` before exiting your service process. Otherwise your service will be garbage collected after (at most) 10s

## License

MIT
