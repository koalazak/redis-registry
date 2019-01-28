'use strict';

var redis = require('redis');
var crypto = require('crypto');
var address = require('network-address');

var noop = function () {};

var sha1 = function (val) {
  return crypto.createHash('sha1').update(val).digest('hex');
};

var store;

var parseConnectionObject = function (config) {
  if (!config.host) throw new Error('Invalid host.');

  var opts = {
    redis: {}
  };
  opts.namespace = config.namespace || 'rr';
  opts.redis.port = config.port || 6379;
  opts.redis.host = config.host;
  opts.redis.options = config.options || {};

  return opts;
};

module.exports = function (opts) {
  opts = parseConnectionObject(opts);

  if (!store) {
    store = redis.createClient(opts.redis.port, opts.redis.host, opts.redis.options);
  }

  store.on('error', function (error) {
    console.log(error);
  });

  var destroyed = false;

  var ns = (opts.namespace || '').replace(/^\//, '').replace(/([^/])$/, '$1/');
  var prefix = function (key) {
    return 'services/' + ns + key;
  };

  var that = {};
  var services = [];

  var normalize = function (key) {
    return key.replace(/[^a-zA-Z0-9-]/g, '-');
  };

  that.join = function (name, service, cb) {
    if (typeof service === 'function') return that.join(name, null, service);
    if (typeof service === 'number') service = {port: service};
    if (!service) service = {};
    if (!cb) cb = noop;

    service.name = name;
    service.hostname = service.hostname || address(process.env.REGISTRY_INTERFACE || '');
    service.host = service.host || (service.port ? service.hostname + ':' + service.port : service.hostname);
    service.url = service.url || (service.protocol || 'http') + '://' + service.host;

    var key = prefix(normalize(name) + '/' + sha1(name + '-' + service.url));
    var value = JSON.stringify(service);
    var entry = {name: name, key: key, destroyed: false, timeout: null};

    var update = function (cb) {
      const multi = store.multi();
      multi.set(key, value);
      multi.expire(key, 10);
      multi.exec(cb);
    };

    var loop = function () {
      update(function (err) {
        if (entry.destroyed) return;
        entry.timeout = setTimeout(loop, err ? 15000 : 5000);
      });
    };

    var onerror = function (err) {
      leave([entry], function () {
        cb(err);
      });
    };

    services.push(entry);
    update(function (err) {
      if (err) return onerror(err);
      if (destroyed) return onerror(new Error('registry destroyed'));

      entry.timeout = setTimeout(loop, 5000);
      cb(null, service);
    });
  };

  that.lookup = function (name, cb) {
    if (typeof name === 'function') return that.lookup(null, name);

    that.list(name, function (err, list) {
      if (err) return cb(err);
      if (!list.length) return cb(null, null);
      cb(null, list[(Math.random() * list.length) | 0]);
    });
  };

  that.list = function (name, cb) {
    if (typeof name === 'function') return that.list(null, name);
    if (name) name = normalize(name);

    store.keys(`${prefix(name || '')}*`, function (err, reply) {
      if (err) {
        return cb(err);
      }

      if (!reply || reply.length === 0) {
        return cb(null, []);
      }

      store.mget(reply, function (err, replies) {
        if (err) {
          return cb(err);
        }
        if (!replies || replies.length === 0) {
          return cb(null, []);
        }

        var list = replies
          .map(function (node) {
            try {
              return JSON.parse(node);
            } catch (err) {
              return null;
            }
          })
          .filter(function (val) {
            return val;
          });

        cb(null, list);
      });
    });
  };

  var leave = function (list, cb) {
    var loop = function () {
      var next = list.shift();

      if (!next) return cb();

      clearTimeout(next.timeout);
      next.destroyed = true;

      var i = services.indexOf(next);
      if (i > -1) services.splice(next, 1);

      store.del(next.key, loop);
    };

    loop();
  };

  that.leave = function (name, cb) {
    var list = services.filter(function (entry) {
      return entry.name === name;
    });

    leave(list, cb || noop);
  };

  return that;
};
