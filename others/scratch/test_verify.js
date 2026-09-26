const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/pass/verify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', e => console.error(e));
req.write(JSON.stringify({ query: 'MAH-MU366OZ6-XXBD' }));
req.end();
