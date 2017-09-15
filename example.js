const registry = require('./');

const client = registry({host: 'redis-host'});

client.join('test', {
  port: 8080,
  inserted: Date.now()
}, function () {
  setTimeout(function () {
    client.lookup('test', function (err, service) {
      console.log('error:', err);
      console.log('service:', service);
      client.leave('test');
    });
  }, 100);
});
